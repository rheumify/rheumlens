import { getQuestions } from '@/lib/airtable';

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const includeDrafts =
      searchParams.get('preview') === 'true' || process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
    const questions = shuffle(await getQuestions({ category, includeDrafts }));
    return Response.json({ questions });
  } catch (e) {
    return Response.json({ error: e.message, questions: [] }, { status: 500 });
  }
}
