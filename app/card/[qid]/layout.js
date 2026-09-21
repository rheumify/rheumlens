import { getQuestions } from '@/lib/airtable';

// Server layout that gives each /card/<qid> permalink its own <title>,
// description, and canonical URL. The page itself stays a client component;
// this only adds head metadata so search results don't show the generic
// site title for every card. Falls back to the site defaults on any error.

const SITE = 'https://rheumlens.org';

function stripTag(s) {
  return (s || '').replace(/^\[(DRAFT|NEW)\]\s*/i, '').trim();
}

export async function generateMetadata({ params }) {
  const { qid: raw } = await params;
  const qid = decodeURIComponent(raw || '');
  const canonical = `${SITE}/card/${encodeURIComponent(qid)}`;
  try {
    const qs = await getQuestions();
    const q = qs.find((c) => c.questionId === qid);
    if (!q) {
      return { title: 'Card not found — RheumLens', robots: { index: false } };
    }
    const name = q.diagnosis || stripTag(q.title) || `Card ${qid}`;
    const bits = [q.imageType, q.category, q.joint].filter(Boolean).join(' · ');
    const description = q.teachingPoint
      ? q.teachingPoint.slice(0, 155)
      : `${name}${bits ? ` (${bits})` : ''} — a rheumatology image flip card from RheumLens, a free image-based question bank.`;
    return {
      title: `${name}${q.imageType ? ` — ${q.imageType}` : ''} | RheumLens`,
      description,
      alternates: { canonical },
      openGraph: {
        title: `${name} | RheumLens`,
        description,
        url: canonical,
        siteName: 'RheumLens',
        type: 'article',
        ...(q.imageUrl ? { images: [{ url: q.imageUrl, alt: q.imageAlt || name }] } : {}),
      },
    };
  } catch {
    return { alternates: { canonical } };
  }
}

export default function CardLayout({ children }) {
  return children;
}
