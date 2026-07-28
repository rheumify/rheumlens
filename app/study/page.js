'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getStats } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
// Questions (quiz mode) are held back for the flip-cards-first launch.
const QUIZ_ENABLED = false;

export default function StudyHub() {
  const [categories, setCategories] = useState(null);
  const [imageTypes, setImageTypes] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [style, setStyle] = useState('flip');
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setStats(getStats());
    const url = new URL('/api/categories', window.location.origin);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCategories(d.categories || []); setImageTypes(d.imageTypes || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
    fetch('/api/progress')
      .then((r) => r.json())
      .then((d) => setSignedIn(!!d.signedIn))
      .catch(() => {});
  }, []);

  const total = (categories || []).reduce((s, c) => s + c.count, 0);
  const q = (params) => `/study/session?${params}&style=${style}`;

  const Toggle = (
    <div className="style-toggle">
      {[['flip', 'Flip cards', false], ['quiz', 'Quiz', !QUIZ_ENABLED]].map(([val, label, soon]) => {
        const locked = val === 'quiz' && !QUIZ_ENABLED;
        return (
          <button key={val} className={style === val ? 'active' : ''} disabled={locked}
            style={locked ? { cursor: 'default', opacity: 0.6 } : undefined}
            onClick={() => { if (!locked) setStyle(val); }}>
            {label}{soon && <span className="soon">soon</span>}
          </button>
        );
      })}
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

      {stats && stats.streak > 0 && (
        <p className="muted" style={{ marginTop: 10 }}>
          🔥 {stats.streak}-day streak
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
          {signedIn && (
            <Link href={q('mode=favorites')} className="choice"><span>Favorites ★</span><span>›</span></Link>
          )}
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

      {imageTypes && imageTypes.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>By image type</h3>
          <p className="muted" style={{ margin: '0 0 4px', fontSize: '.9rem' }}>
            Drill one kind of image — crystals under the microscope, radiographs, ultrasound, CT/MRI, clinical photos, and more.
          </p>
          <div className="choice-list">
            {imageTypes.map((t) => (
              <Link key={t.name} href={q(`mode=imagetype&imageType=${encodeURIComponent(t.name)}`)} className="choice">
                <span>{t.name}</span><span className="count-badge">{t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
