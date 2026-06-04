// Upload local RheumLens images to Vercel Blob and attach the public URL to the
// matching Airtable question (by Question ID). Run AFTER you've created a Blob store.
//
//   1) put your labeled images in ./images-to-upload/  named  <QuestionID>.jpg
//      e.g.  RL-001.jpg, RL-003.jpg  (Question ID must match the Airtable record)
//   2) export env:  BLOB_READ_WRITE_TOKEN, AIRTABLE_API_KEY, AIRTABLE_BASE_ID
//   3) npm run upload-images
//
// It uploads each file, then PATCHes the Airtable record's "Image" attachment field
// with the returned public URL (Airtable ingests it and serves its own copy).

import { put } from '@vercel/blob';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve('./images-to-upload');
const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN');
if (!BASE || !KEY) throw new Error('Set AIRTABLE_BASE_ID and AIRTABLE_API_KEY');

async function findRecordId(questionId) {
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
  url.searchParams.set('filterByFormula', `{Question ID} = '${questionId}'`);
  url.searchParams.set('maxRecords', '1');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
  const data = await res.json();
  return data.records?.[0]?.id || null;
}

async function attach(recordId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`Airtable PATCH ${res.status}: ${await res.text()}`);
}

const files = (await readdir(DIR)).filter((f) => /\.(jpe?g|png)$/i.test(f));
console.log(`Found ${files.length} image(s) in ${DIR}`);

for (const file of files) {
  const questionId = path.parse(file).name; // e.g. RL-001
  const recId = await findRecordId(questionId);
  if (!recId) { console.warn(`! No Airtable record for ${questionId} — skipping`); continue; }
  const buf = await readFile(path.join(DIR, file));
  const blob = await put(`rheumlens/${file}`, buf, { access: 'public', addRandomSuffix: false });
  await attach(recId, { Image: [{ url: blob.url }], 'Hosted URL': blob.url });
  console.log(`✓ ${questionId} → ${blob.url}`);
}
console.log('Done.');
