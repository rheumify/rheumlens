// Per-card study progress for signed-in users.
//
//   GET  -> { signedIn, rows, summary }   everything this user has studied
//   POST -> { ok: true }                  record one encounter with one card
//
// Signed-out visitors are not an error here: they get { signedIn: false } and
// the client keeps its localStorage copy. Progress that follows you across
// devices is the thing an account buys; the site itself needs no account.
import { listUserProgress, recordEncounter, summarize } from '@/lib/userProgress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HAS_CLERK =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const RESULTS = ['correct', 'missed', 'seen'];
const SIGNED_OUT = { signedIn: false, rows: [], summary: null };

// { userId, email } for the current session, or null when signed out / no Clerk.
async function currentUser() {
  if (!HAS_CLERK) return null;
  try {
    const { auth, clerkClient } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    if (!userId) return null;
    let email = '';
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user?.primaryEmailAddress?.emailAddress || '';
    } catch {
      // A missing email is not worth failing the write over.
    }
    return { userId, email };
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json(SIGNED_OUT);
  try {
    const rows = await listUserProgress(user.userId);
    return Response.json({ signedIn: true, rows, summary: summarize(rows) });
  } catch (e) {
    console.error('[progress/record] read failed:', e.message);
    return Response.json({ ...SIGNED_OUT, signedIn: true, error: 'Could not load progress.' }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await currentUser();
  // Not an error: the client fires this optimistically and ignores the result.
  if (!user) return Response.json({ signedIn: false, saved: false });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send JSON { questionId, result }.' }, { status: 400 });
  }

  const questionId = String(body?.questionId || '').trim().slice(0, 300);
  const result = String(body?.result || 'seen').trim().toLowerCase();
  if (!questionId) return Response.json({ error: 'questionId is required.' }, { status: 400 });
  if (!RESULTS.includes(result)) {
    return Response.json({ error: `result must be one of ${RESULTS.join(', ')}.` }, { status: 400 });
  }

  try {
    await recordEncounter({ userId: user.userId, email: user.email, questionId, result });
    return Response.json({ ok: true, saved: true });
  } catch (e) {
    console.error('[progress/record] write failed:', e.message);
    return Response.json({ error: 'Could not save progress.' }, { status: 500 });
  }
}
