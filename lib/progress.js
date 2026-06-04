// Anonymous progress, stored in the browser. No account required.
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
  localStorage.setItem(KEY, JSON.stringify(p));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getProgress() { return read(); }

export function recordAnswer(questionId, correct) {
  const p = read();
  p.answers[questionId] = { correct, ts: Date.now() };
  const d = today();
  if (!p.activeDates.includes(d)) p.activeDates.push(d);
  write(p);
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
