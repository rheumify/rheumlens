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
// Shape: {
//   answers:     { [questionId]: { correct: bool, ts: number } }  // rated cards
//   seen:        [questionId]                                     // every card met
//   quiz:        [questionId]                                     // answered as a question
//   favorites:   [questionId]
//   activeDates: [YYYY-MM-DD]
// }
//
// `seen` is wider than `answers`: revealing a card counts as seeing it even if
// the learner never says whether they knew it. That distinction is the whole
// point of the "new to me" deck.
//
// `quiz` is narrower still: only cards where they actually picked A/B/C/D in
// question mode. Meeting an image as a flip card does not put it here, which is
// what lets the practice page count the two decks independently.
const KEY = 'rheumlens_progress_v1';

function blank() {
  return { answers: {}, seen: [], quiz: [], favorites: [], activeDates: [] };
}

function read() {
  if (typeof window === 'undefined') return blank();
  let p;
  try {
    p = JSON.parse(localStorage.getItem(KEY)) || blank();
  } catch {
    return blank();
  }
  if (!p.answers) p.answers = {};
  // Stored before `quiz` existed. Starting it empty is the honest default: we
  // can't tell retrospectively which of those cards were answered as questions.
  if (!Array.isArray(p.quiz)) p.quiz = [];
  if (!p.favorites) p.favorites = [];
  if (!p.activeDates) p.activeDates = [];
  // Stored before `seen` existed: anything they answered, they saw. Without this
  // an existing learner would be told the whole deck is new to them.
  if (!Array.isArray(p.seen)) p.seen = Object.keys(p.answers);
  return p;
}
function write(p) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode / full quota */ }
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function markSeen(p, questionId) {
  if (questionId && !p.seen.includes(questionId)) p.seen.push(questionId);
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

// Shared by both modes: record the grade, mark the card seen, count the day.
function rateCard(p, questionId, correct) {
  p.answers[questionId] = { correct, ts: Date.now() };
  markSeen(p, questionId);
  const d = today();
  if (!p.activeDates.includes(d)) p.activeDates.push(d);
}

// Question mode: the learner picked A/B/C/D. This is the only path that counts
// toward question progress.
export function recordAnswer(questionId, correct) {
  const p = read();
  rateCard(p, questionId, correct);
  if (questionId && !p.quiz.includes(questionId)) p.quiz.push(questionId);
  write(p);
  mirror(questionId, correct ? 'quiz-correct' : 'quiz-missed');
  return p;
}

// The learner met this card but didn't rate themselves. Counts toward "seen"
// and toward the day's streak; does not touch their correct/missed record.
export function recordSeen(questionId) {
  const p = read();
  const already = p.seen.includes(questionId);
  markSeen(p, questionId);
  const d = today();
  if (!p.activeDates.includes(d)) p.activeDates.push(d);
  write(p);
  if (!already) mirror(questionId, 'seen');
  return p;
}

// Flip mode self-rating: "I knew this" / "review this again". Grades the card
// but deliberately does NOT touch `quiz`: a flip card they graded themselves is
// not a question they answered.
export function recordSelfRating(questionId, knewIt) {
  const p = read();
  rateCard(p, questionId, !!knewIt);
  write(p);
  mirror(questionId, knewIt ? 'correct' : 'missed');
  return p;
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
export function getSeenIds() { return read().seen; }
export function getQuizAnsweredIds() { return read().quiz; }
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
    seen: p.seen.length,
    correct,
    missed: ids.length - correct,
    accuracy: ids.length ? Math.round((correct / ids.length) * 100) : 0,
    favorites: p.favorites.length,
    streak: computeStreak(p.activeDates || []),
  };
}

// Merge the server's rows into the local store, so a signed-in user opening the
// site on a new device sees their real history instead of an empty one. Local
// wins on a rated card: it is the newer signal.
export function mergeServerRows(rows) {
  if (typeof window === 'undefined' || !Array.isArray(rows) || !rows.length) return read();
  const p = read();
  rows.forEach((r) => {
    if (!r || !r.questionId) return;
    markSeen(p, r.questionId);
    if (!p.answers[r.questionId]) {
      if (r.lastResult === 'Correct') p.answers[r.questionId] = { correct: true, ts: 0 };
      else if (r.lastResult === 'Missed') p.answers[r.questionId] = { correct: false, ts: 0 };
    }
    if (r.quizAnswered > 0 && !p.quiz.includes(r.questionId)) p.quiz.push(r.questionId);
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
