// Study progress.
//
// Two layers, deliberately:
//
//   1. The browser (localStorage) is the source of truth for the current
//      session. It works with no account, it works offline, and a failed
//      network call never costs the learner their place in the deck.
//   2. For a SIGNED-IN user every encounter is also mirrored to the server
//      (/api/progress/record -> Airtable "User Progress"). That is what makes
//      progress survive a new device, and it is the only thing an account buys.
//
// The mirror is fire-and-forget on purpose: nothing in the UI waits for it, and
// a server that is down degrades to exactly the old anonymous behaviour.
//
// Shape: { answers: { [questionId]: { correct: bool, ts: number } }, favorites: [questionId], activeDates: [YYYY-MM-DD] }
const KEY = 'rheumlens_progress_v1';

function read() {
  if (typeof window === 'undefined') return { answers: {}, favorites: [], activeDates: [] };
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { answers: {}, favorites: [], activeDates: [] };
  } catch {
    return { answers: {}, favorites: [], activeDates: [] };
  }
}
function write(p) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode / full quota */ }
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Fire-and-forget mirror to the server. The server decides whether there is a
// signed-in user; for a signed-out visitor this is a cheap no-op that returns
// { saved: false }. Nothing in the UI waits for it.
function mirror(questionId, result) {
  if (typeof window === 'undefined' || !questionId) return;
  try {
    fetch('/api/progress/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, result }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* never let progress reporting break the session */ }
}

export function getProgress() { return read(); }

export function recordAnswer(questionId, correct) {
  const p = read();
  p.answers[questionId] = { correct, ts: Date.now() };
  const d = today();
  if (!p.activeDates.includes(d)) p.activeDates.push(d);
  write(p);
  mirror(questionId, correct ? 'correct' : 'missed');
  return p;
}

// Flip mode: the learner revealed the finding but didn't rate themselves.
// Counts the card as seen, locally and on the server, without claiming it known.
export function recordSeen(questionId) {
  const p = read();
  const d = today();
  if (!p.activeDates.includes(d)) { p.activeDates.push(d); write(p); }
  mirror(questionId, 'seen');
  return p;
}

// Flip mode self-rating: "I knew this" / "review this again". Writes the same
// shape as a quiz answer so the Review-misses deck works in flip mode too.
export function recordSelfRating(questionId, knewIt) {
  return recordAnswer(questionId, !!knewIt);
}

// Flip-only launch: count a study day toward the streak without recording correctness.
export function markActiveToday() {
  const p = read();
  const d = today();
  if (!p.activeDates.includes(d)) { p.activeDates.push(d); write(p); }
  return p;
}

export function toggleFavorite(questionId) {
  const p = read();
  const i = p.favorites.indexOf(questionId);
  if (i >= 0) p.favorites.splice(i, 1);
  else p.favorites.push(questionId);
  write(p);
  return p.favorites.includes(questionId);
}

export function isFavorite(questionId) { return read().favorites.includes(questionId); }
export function getFavorites() { return read().favorites; }
export function getMissedIds() {
  const a = read().answers;
  return Object.keys(a).filter((id) => a[id] && a[id].correct === false);
}

export function getStats() {
  const p = read();
  const ids = Object.keys(p.answers);
  const correct = ids.filter((id) => p.answers[id].correct).length;
  return {
    answered: ids.length,
    correct,
    accuracy: ids.length ? Math.round((correct / ids.length) * 100) : 0,
    favorites: p.favorites.length,
    streak: computeStreak(p.activeDates || []),
  };
}

// Merge the server's rows into the local store, so a signed-in user opening the
// site on a new device sees the cards they've already missed in "Review misses"
// instead of an empty deck. Local wins on conflict: it is the newer signal.
export function mergeServerRows(rows) {
  if (typeof window === 'undefined' || !Array.isArray(rows) || !rows.length) return read();
  const p = read();
  rows.forEach((r) => {
    if (!r || !r.questionId) return;
    if (!p.answers[r.questionId]) {
      if (r.lastResult === 'Correct') p.answers[r.questionId] = { correct: true, ts: 0 };
      else if (r.lastResult === 'Missed') p.answers[r.questionId] = { correct: false, ts: 0 };
    }
    const day = String(r.lastSeen || '').slice(0, 10);
    if (day && !p.activeDates.includes(day)) p.activeDates.push(day);
  });
  write(p);
  return p;
}

function computeStreak(dates) {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let streak = 0;
  const d = new Date();
  // Allow today OR yesterday to start the streak.
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
