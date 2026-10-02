// "Report an issue" — a free-text message about one card, from any visitor.
//
// The site is free and mostly used signed out, so reports are accepted
// anonymously; if the reporter happens to have a Clerk session, their email is
// attached so Ali can write back. Rows land in the Image Reports table and the
// morning briefing reads everything with a blank or "New" status.
//
// This is the only public write path in the app, so it is deliberately narrow:
// one table, a fixed set of fields, a length cap, and a per-IP rate limit.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;
const REPORTS_TABLE = process.env.AIRTABLE_REPORTS_TABLE || 'Image Reports';

const MAX_MESSAGE = 2000;
const MAX_FIELD = 300;

// Per-IP rate limit. In-memory, so it resets on redeploy and is per-instance —
// enough to stop an accidental loop or a bored visitor, not a real abuse
// defence. If this ever gets hit in anger it should move to a shared store.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return false;
}

function clip(v, n) {
  return String(v ?? '').trim().slice(0, n);
}

// The reporter's email, when Clerk is configured AND they are signed in.
// Everything here is best-effort: a signed-out visitor must still be able to
// report, so any failure resolves to an empty string rather than an error.
async function reporterEmail() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) return '';
  try {
    const { auth, clerkClient } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) return '';
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user?.primaryEmailAddress?.emailAddress || '';
  } catch {
    return '';
  }
}

export async function POST(request) {
  if (!BASE_ID || !API_KEY) {
    return Response.json({ error: 'Reporting is not configured.' }, { status: 500 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return Response.json(
      { error: "That's a lot of reports in a short time — try again in a few minutes." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send JSON { questionId, message }.' }, { status: 400 });
  }

  const message = clip(body?.message, MAX_MESSAGE);
  if (!message) return Response.json({ error: 'Please describe the problem.' }, { status: 400 });

  const fields = {
    'Question ID': clip(body?.questionId, MAX_FIELD),
    'Card Title': clip(body?.title, MAX_FIELD),
    Report: message,
    Status: 'New',
    'User Email': await reporterEmail(),
    'Page URL': clip(body?.pageUrl, MAX_FIELD),
    'Reported At': new Date().toISOString(),
    'Record Link': clip(body?.recordId, MAX_FIELD),
  };

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(REPORTS_TABLE)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [{ fields }], typecast: true }),
      },
    );
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    return Response.json({ ok: true });
  } catch (e) {
    // Don't leak Airtable internals to the visitor; the detail goes to the log.
    console.error('[report] write failed:', e.message);
    return Response.json({ error: "Couldn't save that — please try again." }, { status: 500 });
  }
}
