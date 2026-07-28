import { getQuestions } from '@/lib/airtable';

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Drafts and [NEW] uploads are NEVER served to the public. Only a request that
// carries the correct admin secret may preview unpublished / held records.
function isAdmin(request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  return Boolean(secret) && request.headers.get('x-admin-secret') === secret;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const imageType = searchParams.get('imageType') || undefined;
    const admin = isAdmin(request);
    // Public: published, non-held only. Admin + ?preview=true: also drafts + held.
    const includeDrafts = admin && searchParams.get('preview') === 'true';
    const includeHeld = includeDrafts;
    const questions = shuffle(await getQuestions({ category, imageType, includeDrafts, includeHeld }));
    return Response.json({ questions });
  } catch (e) {
    return Response.json({ error: e.message, questions: [] }, { status: 500 });
  }
}
