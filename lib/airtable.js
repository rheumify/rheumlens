// Minimal Airtable REST helper (no SDK dependency).
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;
const QUESTIONS_TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';

const API = 'https://api.airtable.com/v0';

async function listRecords(table, params = {}) {
  if (!BASE_ID || !API_KEY) {
    throw new Error('Airtable env vars missing (AIRTABLE_BASE_ID / AIRTABLE_API_KEY).');
  }
  let records = [];
  let offset;
  do {
    const url = new URL(`${API}/${BASE_ID}/${encodeURIComponent(table)}`);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// Parse the "Related Cards" text field (Question IDs separated by ; , or newlines)
// into a clean array of related Question IDs.
function relatedIds(f) {
  const raw = f['Related Cards'];
  if (!raw) return [];
  return String(raw)
    .split(/[;,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Pull the first usable image URL: hosted attachment first, else a "Hosted URL" text field.
function imageUrl(f) {
  const att = f['Image'];
  if (Array.isArray(att) && att.length && att[0].url) return att[0].url;
  if (f['Hosted URL']) return f['Hosted URL'];
  return null;
}

function shape(rec) {
  const f = rec.fields;
  return {
    id: rec.id,
    questionId: f['Question ID'] || '',
    acrRef: f['ACR Ref #'] || '',
    title: f['Question Title'] || '',
    imageUrl: imageUrl(f),
    imageAlt: f['Image Alt Text'] || '',
    credit: f['Credit'] || 'Copyright ACR — ACR Rheumatology Image Library',
    stem: f['Clinical Stem'] || '',
    leadIn: f['Lead-in'] || '',
    options: { A: f['Option A'] || '', B: f['Option B'] || '', C: f['Option C'] || '', D: f['Option D'] || '' },
    correct: f['Correct Answer'] || '',
    explanation: f['Explanation'] || '',
    teachingPoint: f['Visual Teaching Point'] || '',
    diagnosis: f['Diagnosis'] || '',
    category: f['Category'] || 'Other',
    imageType: f['Image Type'] || '',
    joint: f['Joint'] || '',
    difficulty: f['Difficulty'] || '',
    mnemonic: f['Mnemonic'] || '',
    relatedCards: relatedIds(f),
    published: !!f['Published'],
    needsReview: !!f['Needs Review'],
  };
}

// Normalize a filter arg into an array of non-empty strings.
// Accepts a string, an array of strings, or undefined/null -> [].
function toList(v) {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

// Filters combine as: OR *within* a dimension, AND *across* dimensions.
// e.g. { imageType: ['CT','MRI'], joint: ['Hip'] }  ->  (CT OR MRI) AND Hip.
export async function getQuestions({ category, imageType, joint, includeDrafts = false, includeHeld = false } = {}) {
  const cats = toList(category);
  const types = toList(imageType);
  const joints = toList(joint);
  const recs = await listRecords(QUESTIONS_TABLE);
  let qs = recs.map(shape);
  // Records flagged "Needs Review" are held out of the learner deck (and counts)
  // until Ali resolves them in the admin review queue.
  if (!includeHeld) qs = qs.filter((q) => !q.needsReview);
  if (!includeDrafts) qs = qs.filter((q) => q.published);
  if (cats.length) qs = qs.filter((q) => cats.includes(q.category));
  if (types.length) qs = qs.filter((q) => types.includes(q.imageType));
  if (joints.length) qs = qs.filter((q) => joints.includes(q.joint));
  return qs;
}

function countBy(qs, key) {
  const counts = {};
  qs.forEach((q) => { const v = q[key]; if (v) counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategories({ includeDrafts = false } = {}) {
  return countBy(await getQuestions({ includeDrafts }), 'category');
}

export async function getImageTypes({ includeDrafts = false } = {}) {
  return countBy(await getQuestions({ includeDrafts }), 'imageType');
}

export async function getJoints({ includeDrafts = false } = {}) {
  return countBy(await getQuestions({ includeDrafts }), 'joint');
}

// One pass over the deck -> all three facet lists (used by /api/categories).
export async function getFacets({ includeDrafts = false } = {}) {
  const qs = await getQuestions({ includeDrafts });
  return {
    categories: countBy(qs, 'category'),
    imageTypes: countBy(qs, 'imageType'),
    joints: countBy(qs, 'joint'),
  };
}
