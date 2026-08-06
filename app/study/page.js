'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getStats } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
// Questions (quiz mode) are held back for the flip-cards-first launch.
const QUIZ_ENABLED = false;

// Order the joint chips anatomically (head-to-toe) rather than alphabetically.
const JOINT_ORDER = [
  'TMJ', 'Cervical spine', 'Thoracic spine', 'Lumbar spine', 'Sacroiliac/Pelvis',
  'Shoulder', 'Elbow', 'Wrist', 'Hand', 'Hip', 'Knee', 'Ankle', 'Foot',
  'Multiple', 'Other',
];

const DIMS = [
  { key: 'category', label: 'Topic' },
  { key: 'imageType', label: 'Image type' },
  { key: 'joint', label: 'Joint / region' },
];

export default function StudyHub() {
  const [cards, setCards] = useState(null); // full published deck (used for facet counts)
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [style, setStyle] = useState('flip');
  const [signedIn, setSignedIn] = useState(false);
  const [sel, setSel] = useState({ category: [], imageType: [], joint: [] });

  useEffect(() => {
    setStats(getStats());
    const url = new URL('/api/questions', window.location.origin);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCards(d.questions || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
    fetch('/api/progress')
      .then((r) => r.json())
      .then((d) => setSignedIn(!!d.signedIn))
      .catch(() => {});
  }, []);

  // Cards matching the current selection: OR within a dimension, AND across dimensions.
  const inSel = (val, list) => list.length === 0 || list.includes(val);
  const matched = useMemo(
    () => (cards || []).filter(
      (c) => inSel(c.category, sel.category) && inSel(c.imageType, sel.imageType) && inSel(c.joint, sel.joint)
    ),
    [cards, sel]
  );

  // Facet options + counts. Each option's count reflects the OTHER selected
  // dimensions (so counts show how many you'd get if you added this chip).
  const facets = useMemo(() => {
    const out = {};
    for (const { key } of DIMS) {
      const others = (cards || []).filter((c) =>
        DIMS.every(({ key: k }) => (k === key ? true : inSel(c[k], sel[k])))
      );
      const m = {};
      others.forEach((c) => { const v = c[key]; if (v) m[v] = (m[v] || 0) + 1; });
      let opts = Object.entries(m).map(([name, count]) => ({ name, count }));
      if (key === 'joint') {
        opts.sort((a, b) => {
          const ia = JOINT_ORDER.indexOf(a.name), ib = JOINT_ORDER.indexOf(b.name);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
        });
      } else {
        opts.sort((a, b) => a.name.localeCompare(b.name));
      }
      out[key] = opts;
    }
    return out;
  }, [cards, sel]);

  const anySel = sel.category.length + sel.imageType.length + sel.joint.length > 0;
  const total = (cards || []).length;

  function toggle(dim, name) {
    setSel((s) => {
      const has = s[dim].includes(name);
      return { ...s, [dim]: has ? s[dim].filter((x) => x !== name) : [...s[dim], name] };
    });
  }
  function clearAll() { setSel({ category: [], imageType: [], joint: [] }); }

  function startHref() {
    const p = new URLSearchParams();
    p.set('mode', anySel ? 'filter' : 'random');
    sel.category.forEach((v) => p.append('category', v));
    sel.imageType.forEach((v) => p.append('imageType', v));
    sel.joint.forEach((v) => p.append('joint', v));
    p.set('style', style);
    return `/study/session?${p.toString()}`;
  }

  const q = (params) => `/study/session?${params}&style=${style}`;

  const chipStyle = (on) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 11px', margin: '0 6px 6px 0', borderRadius: 999,
    fontSize: '.9rem', lineHeight: 1.1, cursor: 'pointer',
    border: '1px solid ' + (on ? '#7B6B9E' : 'rgba(128,128,128,.4)'),
    background: on ? '#7B6B9E' : 'transparent',
    color: on ? '#fff' : 'inherit',
    fontWeight: on ? 600 : 400,
    transition: 'background .12s, border-color .12s',
  });
  const countStyle = (on) => ({
    fontSize: '.72rem', opacity: on ? 0.9 : 0.55,
    fontVariantNumeric: 'tabular-nums',
  });

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

      {error && <div className="banner-error" style={{ marginTop: 12 }}>Couldn’t load cards: {error}</div>}

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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Build a set</h3>
          {anySel && (
            <button className="btn ghost" style={{ padding: '2px 6px', fontSize: '.85rem' }} onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
        <p className="muted" style={{ margin: '2px 0 10px', fontSize: '.9rem' }}>
          Tap to pick any mix — e.g. <em>CT</em> + <em>Hip</em> for all CT hips, or <em>MRI</em> + <em>Cervical spine</em>.
          Choices in the same row widen the set; across rows they narrow it.
        </p>

        {!cards && <p className="muted">Loading…</p>}

        {cards && DIMS.map(({ key, label }) => (
          facets[key] && facets[key].length > 0 ? (
            <div key={key} style={{ marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
                {label}
              </div>
              <div>
                {/* keep already-selected chips visible even if their cross-count is 0 */}
                {[...facets[key], ...sel[key].filter((n) => !facets[key].some((o) => o.name === n)).map((n) => ({ name: n, count: 0 }))]
                  .map((o) => {
                    const on = sel[key].includes(o.name);
                    return (
                      <button key={o.name} type="button" aria-pressed={on}
                        onClick={() => toggle(key, o.name)} style={chipStyle(on)}>
                        {o.name}<span style={countStyle(on)}>{o.count}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : null
        ))}

        {cards && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <Link
              href={startHref()}
              className="btn"
              aria-disabled={matched.length === 0}
              onClick={(e) => { if (matched.length === 0) e.preventDefault(); }}
              style={matched.length === 0 ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            >
              {anySel ? `Start ${matched.length} card${matched.length === 1 ? '' : 's'} →` : `Start all ${total} →`}
            </Link>
            {anySel && matched.length === 0 && (
              <span className="muted" style={{ fontSize: '.9rem' }}>No cards match that combination yet.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
