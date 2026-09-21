import { getQuestions } from '@/lib/airtable';

// Served at /sitemap.xml. Lists the public routes plus one permalink per
// published, non-held card so search engines can discover /card/<Question ID>
// pages without crawling through the client-rendered study UI.
// Drafts and held records are never included (getQuestions defaults to public only).

const SITE = 'https://rheumlens.org';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const now = new Date();
  const staticRoutes = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/study`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  let cardRoutes = [];
  try {
    const qs = await getQuestions();
    cardRoutes = qs
      .filter((q) => q.questionId)
      .map((q) => ({
        url: `${SITE}/card/${encodeURIComponent(q.questionId)}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.6,
      }));
  } catch {
    // If Airtable is unreachable, still return the static routes rather than a 500.
  }

  return [...staticRoutes, ...cardRoutes];
}
