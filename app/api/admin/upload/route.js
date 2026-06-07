export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';
const IMAGE_FIELD_ID = process.env.AIRTABLE_IMAGE_FIELD_ID || 'fldjxwnR3yTcKTloE';

function keyFromName(name) {
  const base = name.replace(/\.[^.]+$/, '');
  return base.split('_')[0].trim();
}

// Parse pasted ACR info into { refNumber: { category, title, description } }.
function parseInfoBlocks(text) {
  const byRef = {};
  if (!text || !text.trim()) return byRef;
  const norm = text.replace(/\r/g, '').replace(/\t/g, ': ');
  const blocks = norm.split(/\n(?=\s*Category[:\s])/i);
  for (const b of blocks) {
    const ref = (b.match(/Reference\s*#\s*:?\s*([^\s]+)/i) || [])[1];
    if (!ref) continue;
    byRef[ref.trim()] = {
      category: (b.match(/Category\s*:?\s*(.+)/i) || [])[1]?.trim() || '',
      title: (b.match(/Image\s*Title\s*:?\s*(.+)/i) || [])[1]?.trim() || '',
      description: (b.match(/Description\s*:?\s*([\s\S]+)/i) || [])[1]?.trim() || '',
    };
  }
  return byRef;
}

function mapCategory(acr) {
  const s = (acr || '').toLowerCase();
  if (s.includes('crystal')) return 'Crystal';
  if (s.includes('rheumatoid')) return 'RA';
  if (s.includes('lupus')) return 'SLE';
  if (s.includes('vasculit')) return 'Vasculitis';
  if (s.includes('myositis') || s.includes('myopath')) return 'Myositis';
  if (s.includes('scleros') || s.includes('scleroderma')) return 'Scleroderma';
  if (s.includes('sjogren') || s.includes('sjögren')) return 'Sjogrens';
  if (s.includes('spondyl')) return 'Spondyloarthritis';
  if (s.includes('osteoarthritis')) return 'Osteoarthritis';
  return 'Other';
}

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

async function createRecord(fields) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable create ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function patchFields(recId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${recId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable patch ${res.status}: ${await res.text()}`);
}

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
  const infoByRef = parseInfoBlocks(form.get('info') || '');
  const notes = (form.get('notes') || '').trim();

  const results = [];
  for (const file of files) {
    try {
      const key = keyFromName(file.name);
      const block = infoByRef[key];
      let recId = await findRecordId(key);
      let created = false;

      if (!recId) {
        if (!block && !notes) { results.push({ file: file.name, qid: key, status: 'no-matching-question' }); continue; }
        recId = await createRecord({
          'Question ID': key,
          'ACR Ref #': key,
          'Question Title': `[NEW] ${block?.title || key}`,
          'Category': mapCategory(block?.category),
          'Source Caption': block?.description || '',
          ...(notes ? { 'Notes': notes } : {}),
          'Credit': 'Copyright 2026 ACR',
          'Published': false,
        });
        created = true;
      } else {
        // existing record: stash raw caption + comments without overwriting authored content
        const patch = {};
        if (block) patch['Source Caption'] = block.description;
        if (notes) patch['Notes'] = notes;
        if (Object.keys(patch).length) await patchFields(recId, patch);
      }

      const buf = Buffer.from(await file.arrayBuffer());
      await patchFields(recId, { Image: [] }); // clear so re-uploads replace
      await uploadAttachment(recId, file, buf);
      results.push({ file: file.name, qid: key, status: 'attached', created });
    } catch (e) {
      results.push({ file: file.name, status: 'error', error: e.message });
    }
  }
  const attached = results.filter((r) => r.status === 'attached').length;
  const createdCount = results.filter((r) => r.created).length;
  return Response.json({ attached, created: createdCount, total: files.length, results });
}
