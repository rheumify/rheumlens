import { getCategories } from '@/lib/airtable';

// Draft categories/counts are NEVER exposed to the public — only an admin
// request carrying the correct secret may preview unpublished records.
function isAdmin(request) {
  const secret = process.env.ADMIN_UPLOAD_SECRET;
  return Boolean(secret) && request.headers.get('x-admin-secret') === secret;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = isAdmin(request) && searchParams.get('preview') === 'true';
    const categories = await getCategories({ includeDrafts });
    return Response.json({ categories });
  } catch (e) {
    return Response.json({ error: e.message, categories: [] }, { status: 500 });
  }
}
