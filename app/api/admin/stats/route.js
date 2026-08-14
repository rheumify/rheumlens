// Admin stats — the numbers behind RheumLens in one place.
//
// Two sources, neither of which is visible from the public site:
//   1. Clerk  — optional accounts: how many people signed up, when, and how many
//               of them actually saved anything (favorites / "don't show again").
//               Those lists live on the user's privateMetadata.rheumlens, written
//               by /api/progress.
//   2. Airtable — the content library: published vs draft, split by category, plus
//               the review queues (flagged, question candidates, open comments).
//
// Gated by the same ADMIN_UPLOAD_SECRET as /admin/upload and /admin/review.
// Traffic numbers (visits/pageviews) are NOT here — those live in Vercel Web
// Analytics, which has its own dashboard.
import { clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE = process.env.AIRTABLE_BASE_ID;
const KEY = process.env.AIRTABLE_API_KEY;
const TABLE = process.env.AIRTABLE_QUESTIONS_TABLE || 'Image Questions';

const HAS_CLERK =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const PAGE = 500;   // Clerk's max page size
const MAX_PAGES = 20; // safety stop at 10k users

function authed(request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  return Boolean(secret) && request.headers.get('x-admin-secret') === secret;
}

const DAY = 86400000;
function daysAgo(n) { return Date.now() - n * DAY; }
function ymd(ms) { return new Date(ms).toISOString().slice(0, 10); }
function ym(ms) { return new Date(ms).toISOString().slice(0, 7); }

// ---------------------------------------------------------------- Clerk
async function clerkStats() {
  if (!HAS_CLERK) {
    return { enabled: false, note: 'Clerk env vars are not set on this deployment — accounts are off.' };
  }

  const client = await clerkClient();
  const users = [];
  let totalCount = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await client.users.getUserList({
      limit: PAGE,
      offset: page * PAGE,
      orderBy: '-created_at',
    });
    const batch = res?.data ?? res ?? [];
    if (typeof res?.totalCount === 'number') totalCount = res.totalCount;
    users.push(...batch);
    if (batch.length < PAGE) break;
  }

  const now = Date.now();
  const signupsByDay = {};
  const signupsByMonth = {};
  const favCounts = {};
  const hiddenCounts = {};

  let withProgress = 0;
  let totalFavorites = 0;
  let totalHidden = 0;
  let last7 = 0;
  let last30 = 0;
  let last90 = 0;
  let newestAt = null;
  let oldestAt = null;

  for (const u of users) {
    const created = Number(u.createdAt) || null;
    if (created) {
      if (created > now - 7 * DAY) last7++;
      if (created > now - 30 * DAY) last30++;
      if (created > now - 90 * DAY) last90++;
      signupsByMonth[ym(created)] = (signupsByMonth[ym(created)] || 0) + 1;
      if (created > daysAgo(30)) signupsByDay[ymd(created)] = (signupsByDay[ymd(created)] || 0) + 1;
      if (newestAt === null || created > newestAt) newestAt = created;
      if (oldestAt === null || created < oldestAt) oldestAt = created;
    }

    const p = (u.privateMetadata && u.privateMetadata.rheumlens) || {};
    const favs = Array.isArray(p.favorites) ? p.favorites : [];
    const hid = Array.isArray(p.hidden) ? p.hidden : [];
    if (favs.length || hid.length) withProgress++;
    totalFavorites += favs.length;
    totalHidden += hid.length;
    for (const q of favs) favCounts[q] = (favCounts[q] || 0) + 1;
    for (const q of hid) hiddenCounts[q] = (hiddenCounts[q] || 0) + 1;
  }

  const top = (counts, n = 10) =>
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n)
      .map(([questionId, count]) => ({ questionId, count }));

  return {
    enabled: true,
    totalUsers: totalCount ?? users.length,
    counted: users.length,
    truncated: users.length >= PAGE * MAX_PAGES,
    signups: { last7, last30, last90 },
    firstSignupAt: oldestAt ? new Date(oldestAt).toISOString() : null,
    lastSignupAt: newestAt ? new Date(newestAt).toISOString() : null,
    signupsByMonth: Object.fromEntries(Object.entries(signupsByMonth).sort()),
    signupsByDayLast30: Object.fromEntries(Object.entries(signupsByDay).sort()),
    engagement: {
      accountsWithSavedProgress: withProgress,
      totalFavorites,
      totalHidden,
      avgFavoritesPerActiveAccount: withProgress ? +(totalFavorites / withProgress).toFixed(1) : 0,
    },
    topFavorited: top(favCounts),
    topHidden: top(hiddenCounts, 5),
  };
}

// ------------------------------------------------------------- Airtable
async function contentStats() {
  if (!BASE || !KEY) return { error: 'Airtable env vars missing.' };

  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
    url.searchParams.set('pageSize', '100');
    for (const f of [
      'Question ID', 'Category', 'Image Type', 'Joint',
      'Published', 'Needs Review', 'Create Question', 'Review Comment',
    ]) url.searchParams.append('fields[]', f);
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: 'no-store' });
    if (!res.ok) return { error: `Airtable ${res.status}: ${await res.text()}` };
    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  const byCategory = {};
  const byImageType = {};
  const byJoint = {};
  let published = 0, needsReview = 0, createQuestion = 0, openComments = 0;

  for (const rec of records) {
    const f = rec.fields || {};
    const live = Boolean(f.Published);
    if (live) published++;
    if (f['Needs Review']) needsReview++;
    if (f['Create Question']) createQuestion++;
    if (f['Review Comment']) openComments++;

    const cat = f.Category || '(untagged)';
    byCategory[cat] = byCategory[cat] || { published: 0, draft: 0 };
    byCategory[cat][live ? 'published' : 'draft']++;

    if (live) {
      const t = f['Image Type'] || '(untagged)';
      byImageType[t] = (byImageType[t] || 0) + 1;
      if (f.Joint) byJoint[f.Joint] = (byJoint[f.Joint] || 0) + 1;
    }
  }

  const sortDesc = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));

  return {
    totalCards: records.length,
    published,
    draft: records.length - published,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).sort((a, b) => b[1].published - a[1].published)
    ),
    publishedByImageType: sortDesc(byImageType),
    publishedByJoint: sortDesc(byJoint),
    queues: { needsReview, createQuestion, openReviewComments: openComments },
  };
}

export async function GET(request) {
  if (!authed(request)) {
    return Response.json({ error: 'Unauthorized (bad or missing admin secret).' }, { status: 401 });
  }

  const [accountsResult, contentResult] = await Promise.allSettled([clerkStats(), contentStats()]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    accounts: accountsResult.status === 'fulfilled'
      ? accountsResult.value
      : { enabled: HAS_CLERK, error: accountsResult.reason?.message || 'Clerk lookup failed.' },
    content: contentResult.status === 'fulfilled'
      ? contentResult.value
      : { error: contentResult.reason?.message || 'Airtable lookup failed.' },
    traffic: {
      note: 'Visits and pageviews come from Vercel Web Analytics, not this endpoint.',
      dashboard: 'https://vercel.com/dashboard → rheumlens → Analytics',
    },
  });
}
