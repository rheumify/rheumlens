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
    difficulty: f['Difficulty'] || '',
    mnemonic: f['Mnemonic'] || '',
    published: !!f['Published'],
  };
}

export async function getQuestions({ category, includeDrafts = false } = {}) {
  const recs = await listRecords(QUESTIONS_TABLE);
  let qs = recs.map(shape);
  if (!includeDrafts) qs = qs.filter((q) => q.published);
  if (category) qs = qs.filter((q) => q.category === category);
  return qs;
}

export async function getCategories({ includeDrafts = false } = {}) {
  const qs = await getQuestions({ includeDrafts });
  const counts = {};
  qs.forEach((q) => { counts[q.category] = (counts[q.category] || 0) + 1; });
  return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}
