'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getStats, getSeenIds, mergeServerRows } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
// Quiz mode is live (7 Oct 2026).
const QUIZ_ENABLED = true;

// A card appears in a quiz only if "Question Live" is ticked (Ali has reviewed the
// question) and it carries a keyed answer plus all four options. Every count on this
// page is taken against the deck for the chosen style.
function hasQuestion(c) {
  return Boolean(
    c.questionLive &&
    c.correct && c.options && c.options.A && c.options.B && c.options.C && c.options.D
  );
}

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
  const [favCount, setFavCount] = useState(null);
  const [seenIds, setSeenIds] = useState([]);
  const [sel, setSel] = useState({ category: [], imageType: [], joint: [] });

  useEffect(() => {
    // Let a link choose the style, so the home page can drop someone straight
    // into questions: /study?style=quiz. Anything else stays on flip cards.
    const qs = new URLSearchParams(window.location.search);
    if (QUIZ_ENABLED && qs.get('style') === 'quiz') setStyle('quiz');

    setStats(getStats());
    setSeenIds(getSeenIds());
    const url = new URL('/api/questions', window.location.origin);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setCards(d.questions || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
    // Favorites live on the account, not in this browser, so the badge has to
    // come from the server rather than from the local stats.
    fetch('/api/progress')
      .then((r) => r.json())
      .then((d) => {
        setSignedIn(!!d.signedIn);
        setFavCount(d.signedIn ? (d.favorites || []).length : null);
      })
      .catch(() => {});
    // Pull saved progress for a signed-in account and fold it into the local
    // store, so these counts describe the person rather than the browser.
    fetch('/api/progress/record')
      .then((r) => r.json())
      .then((d) => { if (d.signedIn && d.rows) mergeServerRows(d.rows); })
      .catch(() => {})
      .finally(() => { setStats(getStats()); setSeenIds(getSeenIds()); });
  }, []);

  // The deck for the chosen style: flip can use the whole published library,
  // quiz only the cards that have a written question.
  const deck = useMemo(() => {
    const list = cards || [];
    return style === 'quiz' ? list.filter(hasQuestion) : list;
  }, [cards, style]);

  // Cards matching the current selection: OR within a dimension, AND across dimensions.
  const inSel = (val, list) => list.length === 0 || list.includes(val);
  const matched = useMemo(
    () => deck.filter(
      (c) => inSel(c.category, sel.category) && inSel(c.imageType, sel.imageType) && inSel(c.joint, sel.joint)
    ),
    [deck, sel]
  );

  // Facet options + counts. Each option's count reflects the OTHER selected
  // dimensions (so counts show how many you'd get if you added this chip).
  const facets = useMemo(() => {
    const out = {};
    for (const { key } of DIMS) {
      const others = deck.filter((c) =>
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
  }, [deck, sel]);

  const anySel = sel.category.length + sel.imageType.length + sel.joint.length > 0;
  const total = deck.length;
  // "N of M images seen" is about the library, not the current style's subset.
  const libraryTotal = (cards || []).length;

  // Split the published deck into images this learner has met and images they
  // haven't. Counted against the live deck, so cards added since their last
  // visit show up as new.
  const { newCount, seenCount } = useMemo(() => {
    const seen = new Set(seenIds);
    const n = deck.filter((c) => !seen.has(c.questionId)).length;
    return { newCount: n, seenCount: deck.length - n };
  }, [deck, seenIds]);

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
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '.85rem' }}>
        <span aria-hidden="true" style={{
          display: 'inline-block', width: 8, height: 8, borderRadius: 999, marginRight: 6,
          background: signedIn ? '#2E7D53' : 'rgba(128,128,128,.55)', verticalAlign: 'middle',
        }} />
        {signedIn
          ? 'Signed in — your progress is saved to your account and follows you between devices.'
          : 'Signed out — your progress is saved in this browser only. Signing in is free and optional.'}
      </p>
      {Toggle}

      {stats && (stats.streak > 0 || stats.seen > 0) && (
        <p className="muted" style={{ marginTop: 10 }}>
          {stats.streak > 0 && <>🔥 {stats.streak}-day streak</>}
          {stats.streak > 0 && stats.seen > 0 && ' · '}
          {stats.seen > 0 && libraryTotal > 0 && <>{stats.seen} of {libraryTotal} images seen</>}
        </p>
      )}

      {error && <div className="banner-error" style={{ marginTop: 12 }}>Couldn’t load cards: {error}</div>}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Quick start</h3>
        <div className="choice-list">
          <Link href={q('mode=random')} className="choice">
            <span>Random mix</span><span className="count-badge">{total || '—'}</span>
          </Link>
          <Link href={q('mode=new')} className="choice">
            <span>New to me</span><span className="count-badge">{cards ? newCount : '—'}</span>
          </Link>
          <Link href={q('mode=seen')} className="choice">
            <span>Seen before</span><span className="count-badge">{cards ? seenCount : '—'}</span>
          </Link>
          <Link href={q('mode=missed')} className="choice">
            <span>Review misses</span><span className="count-badge">{stats ? stats.missed : '—'}</span>
          </Link>
          {signedIn ? (
            <Link href={q('mode=favorites')} className="choice">
              <span>Favorites ★</span><span className="count-badge">{favCount === null ? '—' : favCount}</span>
            </Link>
          ) : (
            <span className="choice" style={{ opacity: 0.55, cursor: 'default' }}
              title="Favorites are saved to your account">
              <span>Favorites ★</span><span style={{ fontSize: '.78rem' }}>sign in</span>
            </span>
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
