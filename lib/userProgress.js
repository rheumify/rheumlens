// Per-user, per-card study progress, stored in the "User Progress" table of the
// same Airtable base as the cards.
//
// Why not Clerk private metadata, where favorites and hidden already live?
// That's a small capped JSON blob — fine for a list of card IDs, far too small
// for counters across a ~1,400-card deck. Why not an append-only attempt log?
// Because this is a free site with no analytics ambition: what a learner wants
// back is "have I seen this, did I get it right last time", and that is one row
// per card, upserted. The table then grows with cards studied, not with taps.
//
// Anonymous visitors never reach this module — their progress stays in their own
// browser (lib/progress.js). Signing in is what turns on cross-device progress.

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_PROGRESS_TABLE || 'User Progress';

const API = 'https://api.airtable.com/v0';

function assertConfigured() {
  if (!BASE_ID || !API_KEY) throw new Error('Airtable env vars missing.');
}

function headers() {
  return { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };
}

// Escape a value for use inside a double-quoted Airtable formula string literal.
function formulaString(v) {
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function progressKey(userId, questionId) {
  return `${userId}|${questionId}`;
}

// Every row for one user. Airtable pages at 100, so follow the offset.
export async function listUserProgress(userId) {
  assertConfigured();
  let records = [];
  let offset;
  do {
    const url = new URL(`${API}/${BASE_ID}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set('filterByFormula', `{User ID} = ${formulaString(userId)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const data = await res.json();
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  return records.map((r) => ({
    questionId: r.fields['Question ID'] || '',
    seen: r.fields['Seen'] || 0,
    correct: r.fields['Correct'] || 0,
    lastResult: r.fields['Last Result'] || '',
    lastSeen: r.fields['Last Seen'] || '',
  }));
}

// Record one encounter with one card.
//
// result is 'correct' | 'missed' | 'seen'. 'seen' is flip mode with no
// self-rating: it moves Seen and Last Seen and leaves Correct alone.
//
// Upsert by key: find the row, add to its counters, or create it. Two rapid
// taps on the same card could in principle both read before either writes and
// lose a count — acceptable here, since these are study counters, not a ledger.
export async function recordEncounter({ userId, email, questionId, result }) {
  assertConfigured();
  const key = progressKey(userId, questionId);
  const now = new Date().toISOString();

  const findUrl = new URL(`${API}/${BASE_ID}/${encodeURIComponent(TABLE)}`);
  findUrl.searchParams.set('filterByFormula', `{Key} = ${formulaString(key)}`);
  findUrl.searchParams.set('maxRecords', '1');
  const found = await fetch(findUrl, { headers: headers(), cache: 'no-store' });
  if (!found.ok) throw new Error(`Airtable ${found.status}: ${await found.text()}`);
  const existing = (await found.json()).records[0];

  const lastResult = result === 'correct' ? 'Correct' : result === 'missed' ? 'Missed' : 'Seen';
  const addCorrect = result === 'correct' ? 1 : 0;

  if (existing) {
    const res = await fetch(`${API}/${BASE_ID}/${encodeURIComponent(TABLE)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({
        typecast: true,
        records: [{
          id: existing.id,
          fields: {
            Seen: (existing.fields['Seen'] || 0) + 1,
            Correct: (existing.fields['Correct'] || 0) + addCorrect,
            'Last Result': lastResult,
            'Last Seen': now,
          },
        }],
      }),
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    return;
  }

  const res = await fetch(`${API}/${BASE_ID}/${encodeURIComponent(TABLE)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      typecast: true,
      records: [{
        fields: {
          Key: key,
          'User ID': userId,
          'User Email': email || '',
          'Question ID': questionId,
          Seen: 1,
          Correct: addCorrect,
          'Last Result': lastResult,
          'First Seen': now,
          'Last Seen': now,
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
}

// Roll a user's rows into the numbers the study pages actually display.
export function summarize(rows) {
  const studied = rows.length;
  const correct = rows.filter((r) => r.lastResult === 'Correct').length;
  const missed = rows.filter((r) => r.lastResult === 'Missed').length;
  const days = new Set(rows.map((r) => String(r.lastSeen).slice(0, 10)).filter(Boolean));
  return {
    studied,
    correct,
    missed,
    // Cards whose most recent outcome was a miss — the "review these" deck.
    missedIds: rows.filter((r) => r.lastResult === 'Missed').map((r) => r.questionId),
    activeDays: days.size,
    lastStudied: rows.reduce((m, r) => (r.lastSeen > m ? r.lastSeen : m), ''),
  };
}
