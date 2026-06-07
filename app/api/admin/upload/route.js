export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';
// Image (attachment) field id on the Image Questions table.
const IMAGE_FIELD_ID = process.env.AIRTABLE_IMAGE_FIELD_ID || 'fldjxwnR3yTcKTloE';

// "RL-001_gout_pelvis.jpg" -> "RL-001" ; "RL-001.jpg" -> "RL-001" ; "99-14-0055.tif" -> "99-14-0055"
function keyFromName(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return base.split('_')[0].trim();
}

// Match by Question ID first, then by ACR Ref # (so raw ACR-numbered files attach too).
async function findRecordId(key) {
  for (const field of ['Question ID', 'ACR Ref #']) {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set('filterByFormula', `{${field}} = '${key}'`);
    url.searchParams.set('maxRecords', '1');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.records?.[0]) return data.records[0].id;
  }
  return null;
}

// Clear the Image field so re-uploads replace rather than append.
async function clearImage(recId) {
  await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${recId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { Image: [] } }),
  });
}

// Upload the file bytes straight into Airtable's attachment field (Airtable hosts + serves it).
async function uploadAttachment(recId, file, buf) {
  const res = await fetch(`https://content.airtable.com/v0/${BASE}/${recId}/${IMAGE_FIELD_ID}/uploadAttachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: file.type || 'image/jpeg', filename: file.name, file: buf.toString('base64') }),
  });
  if (!res.ok) throw new Error(`Airtable upload ${res.status}: ${await res.text()}`);
}

export async function POST(request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  if (!secret) return Response.json({ error: 'ADMIN_UPLOAD_SECRET not configured on the server.' }, { status: 500 });
  if (request.headers.get('x-admin-secret') !== secret) {
    return Response.json({ error: 'Unauthorized (bad or missing admin secret).' }, { status: 401 });
  }
  if (!BASE || !KEY) return Response.json({ error: 'Airtable env vars missing.' }, { status: 500 });

  let form;
  try { form = await request.formData(); }
  catch { return Response.json({ error: 'Send multipart/form-data with a "files" field.' }, { status: 400 }); }

  const files = form.getAll('files').filter((f) => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return Response.json({ error: 'No files received.' }, { status: 400 });

  const results = [];
  for (const file of files) {
    try {
      const key = keyFromName(file.name);
      const recId = await findRecordId(key);
      if (!recId) { results.push({ file: file.name, qid: key, status: 'no-matching-question' }); continue; }
      const buf = Buffer.from(await file.arrayBuffer());
      await clearImage(recId);
      await uploadAttachment(recId, file, buf);
      results.push({ file: file.name, qid: key, status: 'attached' });
    } catch (e) {
      results.push({ file: file.name, status: 'error', error: e.message });
    }
  }
  const attached = results.filter((r) => r.status === 'attached').length;
  return Response.json({ attached, total: files.length, results });
}
