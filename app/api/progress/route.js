// Per-account favorites + hidden ("don't show again") cards, stored on the
// Clerk user's private metadata so they follow the user across devices.
// Anonymous visitors get { signedIn: false } and no lists — the favorites and
// hide features are logged-in-only by design.
import { auth, clerkClient } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HAS_CLERK =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const EMPTY = { signedIn: false, favorites: [], hidden: [] };
const ACTIONS = ['favorite', 'unfavorite', 'hide', 'unhide'];

async function readLists(userId) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const p = (user.privateMetadata && user.privateMetadata.rheumlens) || {};
  return {
    favorites: Array.isArray(p.favorites) ? p.favorites : [],
    hidden: Array.isArray(p.hidden) ? p.hidden : [],
  };
}

export async function GET() {
  if (!HAS_CLERK) return Response.json(EMPTY);
  try {
    const { userId } = await auth();
    if (!userId) return Response.json(EMPTY);
    const lists = await readLists(userId);
    return Response.json({ signedIn: true, ...lists });
  } catch (e) {
    return Response.json({ ...EMPTY, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  if (!HAS_CLERK) return Response.json({ error: 'Accounts are not enabled.' }, { status: 400 });
  let userId;
  try { ({ userId } = await auth()); } catch { userId = null; }
  if (!userId) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'Send JSON { action, questionId }.' }, { status: 400 }); }
  const { action, questionId } = body || {};
  if (!questionId || !ACTIONS.includes(action)) {
    return Response.json({ error: 'Send { action: favorite|unfavorite|hide|unhide, questionId }.' }, { status: 400 });
  }

  try {
    const cur = await readLists(userId);
    const favs = new Set(cur.favorites);
    const hidden = new Set(cur.hidden);
    if (action === 'favorite') favs.add(questionId);
    if (action === 'unfavorite') favs.delete(questionId);
    if (action === 'hide') { hidden.add(questionId); favs.delete(questionId); }
    if (action === 'unhide') hidden.delete(questionId);
    const next = { favorites: [...favs], hidden: [...hidden] };
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, { privateMetadata: { rheumlens: next } });
    return Response.json({ signedIn: true, ...next });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
