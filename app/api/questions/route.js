import { getQuestions } from '@/lib/airtable';

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Read a filter param that may be repeated (?imageType=CT&imageType=MRI) or
// comma-separated (?imageType=CT,MRI). Returns an array of trimmed values.
function multi(searchParams, key) {
  const all = searchParams.getAll(key);
  const raw = all.length ? all : [];
  return raw
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter(Boolean);
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
    // Each dimension accepts multiple values (OR within); dimensions combine with AND.
    const category = multi(searchParams, 'category');
    const imageType = multi(searchParams, 'imageType');
    const joint = multi(searchParams, 'joint');
    const admin = isAdmin(request);
    // Public: published, non-held only. Admin + ?preview=true: also drafts + held.
    const includeDrafts = admin && searchParams.get('preview') === 'true';
    const includeHeld = includeDrafts;
    const questions = shuffle(await getQuestions({ category, imageType, joint, includeDrafts, includeHeld }));
    return Response.json({ questions });
  } catch (e) {
    return Response.json({ error: e.message, questions: [] }, { status: 500 });
  }
}
