import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';
const IMAGE_FIELD_ID = process.env.AIRTABLE_IMAGE_FIELD_ID || 'fldjxwnR3yTcKTloE';

// --- Reference-number canonicalisation -------------------------------------
// ACR writes the same reference inconsistently: the library page shows "1/4/8"
// while the downloaded file is named "01-04-0008". Both must collapse to one
// key or the pasted caption never finds its image.
//   "1/4/8"       -> "01-04-0008"
//   "15/13/12"    -> "15-13-0012"
//   "03-04-0031"  -> "03-04-0031"
//   "01040008"    -> "01-04-0008"
//   "1093301"     -> "1093301"   (case-submission IDs pass through untouched)
function normRef(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/\s*\(\d+\)\s*$/, '').trim();      // Finder duplicate suffix
  const parts = s.split(/[/\-_.\s]+/).filter(Boolean);
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b, c] = parts;
    return `${a.padStart(2, '0')}-${b.padStart(2, '0')}-${c.padStart(4, '0')}`;
  }
  if (parts.length === 1 && /^\d{8}$/.test(parts[0])) {
    return `${parts[0].slice(0, 2)}-${parts[0].slice(2, 4)}-${parts[0].slice(4)}`;
  }
  return s;
}

function isRefLike(s) {
  return /^\d{2}-\d{2}-\d{4}$/.test(s) || /^\d{6,8}$/.test(s);
}

// Two different ACR export shapes reach this function and they need opposite
// treatment. Getting this wrong silently overwrites images.
//   Ref-numbered:  "01-04-0008.jpg", "1093301_Relapsing Polychondritis.png",
//                  "03-04-0031 (1).jpg"  -> the part before "_" is the reference.
//   Title-named:   "Tophaceous Gout_ Hands (2).png"  -> ACR writes "_" where a
//                  COLON belongs and reuses one disease name across several
//                  distinct images of the same case. Splitting on "_" here
//                  collapsed every image of a case onto one key, and because the
//                  route clears the Image field before attaching, each upload
//                  overwrote the previous one. The whole basename is the identity.
//                  The trailing " (2)" must be kept for the same reason -- those
//                  are different images, not Finder duplicates.
function keyFromName(name) {
  const base = name.replace(/\.[^.]+$/, '').trim();
  const head = normRef(base.split('_')[0]);
  if (isRefLike(head)) return head;
  return base.replace(/_\s*/g, ': ').replace(/\s+/g, ' ').trim();
}

// Parse pasted ACR info into { byRef, unkeyed }.
// Newer ACR records carry a "Reference #"; the older TIF-era pages have none at
// all and begin at "Category". Splitting on only one of those anchors merged
// several pasted records into a single block and silently kept just the first,
// so we anchor on either. Blocks with a reference are keyed by it; blocks
// without one are kept in paste order for positional pairing rather than
// discarded, which is how captions used to disappear.
function parseInfoBlocks(text) {
  const byRef = {};
  const unkeyed = [];
  if (!text || !text.trim()) return { byRef, unkeyed };
  const norm = text.replace(/\r/g, '').replace(/\t/g, ': ');

  const anchor = /(^|\n)(?=[^\n]*(?:Reference\s*#|Category\s*[:\t]))/gi;
  const starts = [];
  let m;
  while ((m = anchor.exec(norm)) !== null) {
    starts.push(m.index + (m[1] ? m[1].length : 0));
    anchor.lastIndex = m.index + 1;
  }
  const uniq = [...new Set(starts)].sort((a, b) => a - b);
  const chunks = uniq.length
    ? uniq.map((s2, i) => norm.slice(s2, uniq[i + 1] ?? norm.length))
    : [norm];

  for (const b of chunks) {
    const title = (b.match(/Image\s*Title\s*:?\s*(.+)/i) || [])[1]?.trim() || '';
    const description = (b.match(/Description\s*:?\s*([\s\S]+?)(?=\n\s*(?:Body Site|Disease\/Condition|Tissue\/Fluid Type|Image Type|Color Mode|Contributor|Category|Reference\s*#|Uploaded|File size|Dimensions|Color space|File type|Expiration date)\s*[:\t]|$)/i) || [])[1]?.trim() || '';
    if (!title && !description) continue;
    const block = {
      category: (b.match(/Category\s*:?\s*(.+)/i) || [])[1]?.trim() || '',
      title,
      description,
    };
    const ref = (b.match(/Reference\s*#\s*:?\s*([^\s]+)/i) || [])[1];
    if (ref) {
      block.rawRef = ref.trim();
      byRef[normRef(ref)] = block;
    } else {
      // No Reference # on the page at all -- keep it in paste order so it can
      // be paired positionally with the files. Never discard it.
      unkeyed.push(block);
    }
  }
  return { byRef, unkeyed };
}

function mapCategory(acr) {
  const s = (acr || '').toLowerCase();
  if (s.includes('crystal') || s.includes('gout')) return 'Crystal';
  if (s.includes('rheumatoid')) return 'RA';
  if (s.includes('lupus')) return 'SLE';
  if (s.includes('vasculit') || s.includes('behcet') || s.includes('behçet') ||
      s.includes('polyarteritis') || s.includes('kawasaki')) return 'Vasculitis';
  if (s.includes('myositis') || s.includes('myopath') || s.includes('dermatomyositis')) return 'Myositis';
  if (s.includes('scleros') || s.includes('scleroderma')) return 'Scleroderma';
  if (s.includes('sjogren') || s.includes('sjögren')) return 'Sjogrens';
  if (s.includes('spondyl')) return 'Spondyloarthritis';
  if (s.includes('osteoarthritis')) return 'Osteoarthritis';
  if (s.includes('polychondritis')) return 'Relapsing polychondritis';
  if (s.includes('juvenile')) return 'JIA';
  if (s.includes('paget') || s.includes('osteoporos') || s.includes('parathyroid') ||
      s.includes('osteomalacia') || s.includes('rickets') || s.includes('osteopetrosis') ||
      s.includes('osteodystrophy')) return 'Metabolic bone';
  return 'Other';
}

async function findRecordId(key) {
  for (const field of ['Question ID', 'ACR Ref #']) {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set('filterByFormula', `{${field}} = '${key.replace(/'/g, "\\'")}'`);
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
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable create ${res.status}: ${await res.text()}`);
  return (await res.json()).id;
}

async function patchFields(recId, fields) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}/${recId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable patch ${res.status}: ${await res.text()}`);
}

async function uploadAttachment(recId, { buffer, contentType, filename }) {
  const res = await fetch(`https://content.airtable.com/v0/${BASE}/${recId}/${IMAGE_FIELD_ID}/uploadAttachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, filename, file: buffer.toString('base64') }),
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
  const { byRef: infoByRef, unkeyed } = parseInfoBlocks(form.get('info') || '');
  const unkeyedQueue = [...unkeyed];
  const positional = [];
  const notes = (form.get('notes') || '').trim();
  const usedRefs = new Set();
  const seenKeys = new Set();

  const results = [];
  for (const file of files) {
    try {
      const key = keyFromName(file.name);

      // Two files in one batch resolving to the same key means the second would
      // overwrite the first. Never let that happen silently again.
      if (seenKeys.has(key)) {
        results.push({
          file: file.name, qid: key, status: 'duplicate-key-skipped',
          note: 'Another file in this batch already claimed this key; skipped so it would not overwrite that image. Rename one of them and re-upload.',
        });
        continue;
      }
      seenKeys.add(key);

      let block = infoByRef[key];
      let byPosition = false;
      if (block) {
        usedRefs.add(key);
      } else if (unkeyedQueue.length) {
        // Fall back to paste order for blocks ACR gave no Reference # for.
        block = unkeyedQueue.shift();
        byPosition = true;
        positional.push({ qid: key, title: block.title });
      }
      let recId = await findRecordId(key);
      let created = false;

      // NEVER drop an image. If no record matches, make one -- even with no
      // caption block. An image in the bank flagged for review is always
      // recoverable; an image the server threw away is not.
      if (!recId) {
        recId = await createRecord({
          'Question ID': key,
          'ACR Ref #': key,
          'Question Title': block?.title ? `[NEW] ${block.title}` : `[NEEDS CAPTION] ${key}`,
          'Category': mapCategory(block?.category || key),
          'Source Caption': block?.description || '',
          ...(notes ? { 'Notes': notes } : {}),
          ...(block ? {} : {
            'Needs Review': true,
            'Claude Question': `Uploaded with no matching ACR caption block. The file was named "${file.name}" (normalised to ${key}); no pasted block carried a Reference # that resolved to it, and there was no unreferenced block left to pair with it. Paste the ACR Image Title + Description for this reference.`,
          }),
          ...(byPosition ? {
            'Needs Review': true,
            'Claude Question': `Caption matched BY PASTE ORDER, not by reference number: ACR gave no Reference # for this block, so it was paired with this file by position. Check the caption actually describes this image before publishing.`,
          } : {}),
          'Credit': 'Copyright 2026 ACR',
          'Published': false,
        });
        created = true;
      } else {
        const patch = {};
        if (block) patch['Source Caption'] = block.description;
        if (notes) patch['Notes'] = notes;
        if (byPosition) {
          patch['Needs Review'] = true;
          patch['Claude Question'] = `Caption matched BY PASTE ORDER, not by reference number: ACR gave no Reference # for this block, so it was paired with this file by position. Check the caption actually describes this image before publishing.`;
        }
        if (Object.keys(patch).length) await patchFields(recId, patch);
      }

      // Convert TIF (which browsers can't display) to JPG before attaching.
      let buffer = Buffer.from(await file.arrayBuffer());
      let contentType = file.type || 'image/jpeg';
      let filename = file.name;
      if (/\.tiff?$/i.test(file.name) || contentType.includes('tiff')) {
        buffer = await sharp(buffer).jpeg({ quality: 88 }).toBuffer();
        contentType = 'image/jpeg';
        filename = file.name.replace(/\.[^.]+$/, '.jpg');
      }

      await patchFields(recId, { Image: [] }); // clear so re-uploads replace
      await uploadAttachment(recId, { buffer, contentType, filename });
      results.push({
        file: file.name, qid: key, status: 'attached', created, caption: !!block,
        captionByPosition: byPosition || undefined,
      });
    } catch (e) {
      results.push({ file: file.name, status: 'error', error: e.message });
    }
  }

  // Caption blocks that were pasted but matched no uploaded file. Surfacing
  // these is the whole point: a caption that quietly goes nowhere is the
  // failure mode that cost the most rework.
  const orphanBlocks = Object.entries(infoByRef)
    .filter(([k]) => !usedRefs.has(k))
    .map(([k, v]) => ({ normalised: k, asPasted: v.rawRef, title: v.title }));
  // Reference-less blocks left over after positional pairing ran out of files.
  const leftoverUnkeyed = unkeyedQueue.map((v) => ({ title: v.title, noReference: true }));

  const attached = results.filter((r) => r.status === 'attached').length;
  const createdCount = results.filter((r) => r.created).length;
  const missingCaption = results.filter((r) => r.status === 'attached' && !r.caption)
    .map((r) => r.qid);
  const duplicateKeys = results.filter((r) => r.status === 'duplicate-key-skipped')
    .map((r) => r.file);

  return Response.json({
    attached,
    created: createdCount,
    total: files.length,
    missingCaption,          // attached, but no caption text landed
    orphanBlocks,            // caption pasted, but no file matched it
    leftoverUnkeyed,         // reference-less blocks with no file left to pair
    matchedByPosition: positional,  // paired by paste order -- VERIFY THESE
    duplicateKeys,           // skipped rather than overwrite a sibling image
    results,
  });
}
