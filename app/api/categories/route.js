import { getCategories } from '@/lib/airtable';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts =
      searchParams.get('preview') === 'true' || process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
    const categories = await getCategories({ includeDrafts });
    return Response.json({ categories });
  } catch (e) {
    return Response.json({ error: e.message, categories: [] }, { status: 500 });
  }
}
