import { getQuestions } from '@/lib/airtable';

// Server layout that gives each /card/<qid> permalink its own <title>,
// description, canonical URL, and social-preview image. The page itself stays
// a client component; this only adds head metadata so search results don't
// show the generic site title for every card. Falls back to the site defaults
// on any error.
//
// Preview images point at /card/<qid>/image (a stable proxy) rather than the
// raw Airtable attachment URL, which expires after a few hours and would break
// cached previews on Substack / X / LinkedIn / Slack.

const SITE = 'https://rheumlens.org';

function stripTag(s) {
  return (s || '').replace(/^\[(DRAFT|NEW)\]\s*/i, '').trim();
}

export async function generateMetadata({ params }) {
  const { qid: raw } = await params;
  const qid = decodeURIComponent(raw || '');
  const encoded = encodeURIComponent(qid);
  const canonical = `${SITE}/card/${encoded}`;
  const imageProxy = `${SITE}/card/${encoded}/image`;
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
    const images = q.imageUrl ? [{ url: imageProxy, alt: q.imageAlt || name }] : [];
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
        images,
      },
      twitter: {
        card: images.length ? 'summary_large_image' : 'summary',
        title: `${name} | RheumLens`,
        description,
        images: images.map((i) => i.url),
      },
    };
  } catch {
    return { alternates: { canonical } };
  }
}

export default function CardLayout({ children }) {
  return children;
}
