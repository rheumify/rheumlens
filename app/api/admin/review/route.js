export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';
const TABLE_ID = process.env.AIRTABLE_QUESTIONS_TABLE_ID || 'tblrfuk2uD94gwcts';

function authed(request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  return Boolean(secret) && request.headers.get('x-admin-secret') === secret;
}

// GET — review queue.
//   default            → records with the "Needs Review" box checked (flagged).
//   ?scope=all         → every record not yet Published (drafts + [NEW] uploads),
//                        so nothing goes live to users until it's reviewed here.
//   ?scope=questions   → records with "Create Question" checked (good images Ali
//                        flagged to build a full quiz question from later).
export async function GET(request) {
  if (!authed(request)) return Response.json({ error: 'Unauthorized (bad or missing admin secret).' }, { status: 401 });
  if (!BASE || !KEY) return Response.json({ error: 'Airtable env vars missing.' }, { status: 500 });

  const scope = new URL(request.url).searchParams.get('scope');
  const filterFormula =
    scope === 'all' ? 'NOT({Published})'
    : scope === 'questions' ? '{Create Question}'
    : '{Needs Review}';

  const records = [];
  let offset;
  try {
    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
      url.searchParams.set('filterByFormula', filterFormula);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
      if (!res.ok) return Response.json({ error: `Airtable ${res.status}: ${await res.text()}` }, { status: 502 });
      const data = await res.json();
      records.push(...(data.records || []));
      offset = data.offset;
    } while (offset);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  const items = records.map((rec) => {
    const f = rec.fields || {};
    const att = Array.isArray(f.Image) && f.Image[0] ? f.Image[0] : null;
    const image = att ? (att.thumbnails?.large?.url || att.url) : (f['Hosted URL'] || null);
    return {
      id: rec.id,
      qid: f['Question ID'] || '',
      title: f['Question Title'] || '',
      diagnosis: f['Diagnosis'] || '',
      teachingPoint: f['Visual Teaching Point'] || '',
      category: f.Category || '',
      imageType: f['Image Type'] || '',
      difficulty: f.Difficulty || '',
      claudeQuestion: f['Claude Question'] || '',
      notes: f.Notes || '',
      reviewComment: f['Review Comment'] || '',
      sourceCaption: f['Source Caption'] || '',
      image,
      published: Boolean(f.Published),
      needsReview: Boolean(f['Needs Review']),
      createQuestion: Boolean(f['Create Question']),
      relatedCards: f['Related Cards'] || '',
      linkToRheumify: Boolean(f['Link to Rheumify']),
      airtableUrl: `https://airtable.com/${BASE}/${TABLE_ID}/${rec.id}`,
    };
  });
  items.sort((a, b) => String(a.qid).localeCompare(String(b.qid)));
  return Response.json({ count: items.length, records: items });
}

// POST { id, publish?, createQuestion?, comment? } —
//   { publish:true }          → make the record live: set Published, clear Needs Review.
//   { createQuestion:bool }   → toggle the "Create Question" star (flag good image for a
//                               full question later). Card stays in the current view.
//   { comment:'...' }         → save Ali's review comment for the next Claude session to act on.
//                               Does NOT clear the flag or remove the card — it stays in the queue.
//                               Sending an empty string clears the comment.
//   default                   → clear the "Needs Review" flag (mark resolved).
export async function POST(request) {
  if (!authed(request)) return Response.json({ error: 'Unauthorized (bad or missing admin secret).' }, { status: 401 });
  if (!BASE || !KEY) return Response.json({ error: 'Airtable env vars missing.' }, { status: 500 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send JSON { id }.' }, { status: 400 }); }
  if (!body.id) return Response.json({ error: 'id is required.' }, { status: 400 });

  let fields;
  if (body.publish) {
    fields = { Published: true, 'Needs Review': false };
    // On publish, strip a leading [NEW]/[DRAFT] tag from the title so validated
    // cards read clean in Airtable/admin. (Learners see the Diagnosis, not the title.)
    try {
      const g = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${body.id}`, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      if (g.ok) {
        const rec = await g.json();
        const t = rec.fields?.['Question Title'] || '';
        const cleaned = t.replace(/^\s*\[(NEW|DRAFT)\]\s*/i, '').trim();
        if (cleaned && cleaned !== t) fields['Question Title'] = cleaned;
      }
    } catch { /* non-fatal: publish still proceeds even if the rename lookup fails */ }
  } else if (typeof body.createQuestion === 'boolean') {
    // Toggle the "Create Question" star — flags a strong image to build a full
    // quiz question from later. Keeps the card in the current view.
    fields = { 'Create Question': body.createQuestion };
  } else if (typeof body.linkToRheumify === 'boolean') {
    // Toggle the "Link to Rheumify" flag (cards Ali will link to FROM Rheumify).
    fields = { 'Link to Rheumify': body.linkToRheumify };
  } else if (typeof body.relatedCards === 'string') {
    // Save the "Related Cards" list (Question IDs; ; , or newline separated).
    fields = { 'Related Cards': body.relatedCards };
  } else if (typeof body.comment === 'string') {
    // Save Ali's review comment. Keep the card in the queue so it stays visible
    // until the next Claude session reads the comment, edits the card, and clears it.
    fields = { 'Review Comment': body.comment };
  } else {
    fields = { 'Needs Review': false };
  }

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${body.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) return Response.json({ error: `Airtable ${res.status}: ${await res.text()}` }, { status: 502 });
  return Response.json({ ok: true });
}

// DELETE { id } — permanently remove the record (and its attached image) from
// Airtable. Irreversible; the admin UI guards it with a confirm dialog.
export async function DELETE(request) {
  if (!authed(request)) return Response.json({ error: 'Unauthorized (bad or missing admin secret).' }, { status: 401 });
  if (!BASE || !KEY) return Response.json({ error: 'Airtable env vars missing.' }, { status: 500 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send JSON { id }.' }, { status: 400 }); }
  if (!body.id) return Response.json({ error: 'id is required.' }, { status: 400 });

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${body.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) return Response.json({ error: `Airtable ${res.status}: ${await res.text()}` }, { status: 502 });
  return Response.json({ ok: true, deleted: body.id });
}
