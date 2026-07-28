'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';

export default function StudyHub() {
  const [categories, setCategories] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [style, setStyle] = useState('flip');

  useEffect(() => {
    setStats(getStats());
    const url = new URL('/api/categories', window.location.origin);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCategories(d.categories || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
  }, []);

  const total = (categories || []).reduce((s, c) => s + c.count, 0);
  const q = (params) => `/study/session?${params}&style=${style}`;

  const Toggle = (
    <div className="style-toggle">
      {[['flip', 'Flip cards', false], ['quiz', 'Quiz', true]].map(([val, label, soon]) => (
        <button key={val} className={style === val ? 'active' : ''} onClick={() => setStyle(val)}>
          {label}{soon && <span className="soon">soon</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h1 style={{ letterSpacing: '-.02em', marginBottom: 2 }}>Practice</h1>
      <p className="muted" style={{ margin: '0 0 2px' }}>
        {style === 'flip'
          ? 'Flip cards — see the image, reveal the finding, move on.'
          : 'Quiz — read the image and pick the answer.'}
      </p>
      {Toggle}

      {stats && stats.answered > 0 && (
        <p className="muted" style={{ marginTop: 10 }}>
          {stats.answered} answered · {stats.accuracy}% correct
          {stats.streak > 0 && <> · 🔥 {stats.streak}-day streak</>}
        </p>
      )}

      {error && <div className="banner-error" style={{ marginTop: 12 }}>Couldn’t load categories: {error}</div>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick start</h3>
        <div className="choice-list">
          <Link href={q('mode=random')} className="choice">
            <span>Random mix</span><span className="count-badge">{total || '—'}</span>
          </Link>
          <Link href={q('mode=missed')} className="choice"><span>Missed questions</span><span>↻</span></Link>
          <Link href={q('mode=favorites')} className="choice"><span>Favorites ★</span><span>›</span></Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>By topic</h3>
        {!categories && <p className="muted">Loading…</p>}
        {categories && categories.length === 0 && (
          <p className="muted">No published questions yet. (Set <code>NEXT_PUBLIC_SHOW_DRAFTS=true</code> to preview drafts.)</p>
        )}
        <div className="choice-list">
          {(categories || []).map((c) => (
            <Link key={c.name} href={q(`mode=topic&category=${encodeURIComponent(c.name)}`)} className="choice">
              <span>{c.name}</span><span className="count-badge">{c.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
