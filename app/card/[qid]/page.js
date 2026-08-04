'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { markActiveToday } from '@/lib/progress';

// Per-card permalink: /card/<Question ID>. A stable, shareable link to a single
// flip card — used for "Related images" navigation between cards and as the
// target Ali links to FROM Rheumify (rheumify -> rheumlens only, never the reverse).
// Public deck only (published, non-held); drafts are not exposed here.
export default function CardPermalink() {
  const params = useParams();
  const qid = decodeURIComponent(params.qid || '');
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => { markActiveToday(); }, []);

  useEffect(() => {
    fetch('/api/questions')
      .then((r) => r.json())
      .then((d) => { setAll(d.questions || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
  }, []);

  if (error && !all) return <div className="banner-error">Could not load: {error}</div>;
  if (!all) return <p className="center muted">Loading…</p>;

  const q = all.find((c) => c.questionId === qid);
  if (!q) {
    return (
      <div className="card center">
        <p>That card isn&apos;t available (it may be unpublished or the link is off).</p>
        <Link href="/study" className="btn secondary">Go to practice</Link>
      </div>
    );
  }

  const allByQid = {};
  all.forEach((c) => { allByQid[c.questionId] = c; });
  const related = (q.relatedCards || []).map((rid) => allByQid[rid]).filter(Boolean);

  return (
    <div>
      <Link href="/study" className="btn ghost" style={{ paddingLeft: 0 }}>← Practice menu</Link>
      <div className="q-wrap" style={{ marginTop: 8 }}>
        {q.imageUrl ? (
          <div>
            <div className="q-image" onClick={() => setZoom(true)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.imageUrl} alt={q.imageAlt || 'Clinical image'} />
            </div>
            <div className="credit">
              {q.credit}
              {q.acrRef && <> · ACR ref <strong>{q.acrRef}</strong></>} · tap image to zoom
            </div>
          </div>
        ) : (
          <div className="q-image-missing">Image not yet attached for this card.</div>
        )}

        {revealed ? (
          <div className="explain reveal">
            <h4>{q.diagnosis || q.title.replace(/^\[(DRAFT|NEW)\]\s*/i, '')}</h4>
            {q.teachingPoint && <div className="teach"><strong>What to see:</strong> {q.teachingPoint}</div>}
            <div className="chips">
              {q.category && <span className="chip">{q.category}</span>}
              {q.imageType && <span className="chip">{q.imageType}</span>}
            </div>
            {related.length > 0 && (
              <div className="related-links" style={{ marginTop: 12, fontSize: '.9rem' }}>
                <strong>Related images:</strong>{' '}
                {related.map((rc, i) => (
                  <span key={rc.questionId}>
                    {i > 0 ? ' · ' : ''}
                    <Link href={`/card/${encodeURIComponent(rc.questionId)}`}>
                      {rc.diagnosis || rc.title.replace(/^\[(DRAFT|NEW)\]\s*/i, '') || rc.questionId}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button className="btn" onClick={() => setRevealed(true)}>Reveal finding</button>
        )}

        {related.length > 0 && !revealed && (
          <div className="related-links muted" style={{ fontSize: '.85rem' }}>
            This image is part of a set — reveal the finding to see related images.
          </div>
        )}
      </div>

      {zoom && q.imageUrl && (
        <div onClick={() => setZoom(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 50, overflow: 'auto' }}>
          <button onClick={(e) => { e.stopPropagation(); setZoom(false); }}
            style={{ position: 'fixed', top: 12, right: 14, zIndex: 52, background: 'rgba(255,255,255,.16)', color: '#fff',
              border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '.95rem' }}>✕ Close</button>
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.imageUrl} alt={q.imageAlt || ''} style={{ maxWidth: '100%', maxHeight: '92vh', display: 'block' }} />
          </div>
        </div>
      )}
    </div>
  );
}
