import { getQuestionById } from '@/lib/airtable';

// Stable, non-expiring image URL for a published card: /card/<Question ID>/image
// Airtable attachment URLs rotate every few hours, so anything that caches a
// link to them (OpenGraph previews on Substack, X, LinkedIn, Slack, iMessage)
// eventually breaks. This route looks the card up fresh each time, streams the
// current attachment through, and lets the CDN cache the bytes for a day.
// Lives under /card (not /api) so robots.txt allows crawlers to fetch it.
// Public deck only — drafts and held cards return 404.

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { qid: raw } = await params;
  const qid = decodeURIComponent(raw || '');
  if (!qid) return new Response('Not found', { status: 404 });

  let q;
  try {
    q = await getQuestionById(qid);
  } catch {
    return new Response('Upstream error', { status: 502 });
  }
  if (!q || !q.imageUrl) return new Response('Not found', { status: 404 });

  let upstream;
  try {
    upstream = await fetch(q.imageUrl, { cache: 'no-store' });
  } catch {
    return new Response('Upstream error', { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response('Not found', { status: 404 });

  const type = upstream.headers.get('content-type') || 'image/jpeg';
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      // Browser: 1h. Vercel CDN: 1 day, serve stale while refreshing for a week.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      'X-Robots-Tag': 'noindex',
    },
  });
}
