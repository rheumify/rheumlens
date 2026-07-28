'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recordAnswer, getMissedIds } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
const LETTERS = ['A', 'B', 'C', 'D'];

// Favorites and "don't show again" are logged-in-only and stored per account
// (server /api/progress). Answers / missed / streak stay anonymous (localStorage).
export default function QuestionSession({ mode = 'random', category = null, style = 'quiz' }) {
  const flip = style === 'flip';
  const [all, setAll] = useState(null);           // raw questions from the API
  const [account, setAccount] = useState({ signedIn: false, favorites: [], hidden: [], loaded: false });
  const [questions, setQuestions] = useState(null); // session deck, built once
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [zNatural, setZNatural] = useState(false);

  // Load questions.
  useEffect(() => {
    const url = new URL('/api/questions', window.location.origin);
    if (category) url.searchParams.set('category', category);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((d) => { setAll(d.questions || []); if (d.error) setError(d.error); })
      .catch((e) => setError(e.message));
  }, [category]);

  // Load per-account favorites/hidden (the server decides who's signed in).
  useEffect(() => {
    fetch('/api/progress')
      .then((r) => r.json())
      .then((d) => setAccount({ signedIn: !!d.signedIn, favorites: d.favorites || [], hidden: d.hidden || [], loaded: true }))
      .catch(() => setAccount((a) => ({ ...a, loaded: true })));
  }, []);

  // Build the session deck ONCE, after both questions and account are ready, so
  // favoriting/hiding mid-session doesn't reshuffle the current run.
  useEffect(() => {
    if (questions || !all || !account.loaded) return;
    let qs = all;
    if (account.signedIn && account.hidden.length) {
      const h = new Set(account.hidden);
      qs = qs.filter((q) => !h.has(q.questionId));
    }
    if (mode === 'favorites') {
      if (account.signedIn) {
        const f = new Set(account.favorites);
        qs = qs.filter((q) => f.has(q.questionId));
      } else {
        qs = [];
      }
    } else if (mode === 'missed') {
      const ids = new Set(getMissedIds());
      qs = qs.filter((q) => ids.has(q.questionId));
    }
    setQuestions(qs);
  }, [all, account, questions, mode]);

  const q = questions && questions[idx];
  const signedIn = account.signedIn;
  const isFav = q ? account.favorites.includes(q.questionId) : false;

  if (error && !questions?.length) return <div className="banner-error">Could not load questions: {error}</div>;
  if (!questions) return <p className="center muted">Loading…</p>;
  if (!questions.length) {
    return (
      <div className="card center">
        <p>{mode === 'favorites' ? 'No favorites yet — tap the star on a card to save it here.' : 'No questions here yet.'}</p>
        <Link href="/study" className="btn secondary">Back to practice</Link>
      </div>
    );
  }

  async function persist(action, questionId) {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, questionId }),
      });
    } catch { /* optimistic UI already applied */ }
  }
  function toggleFav() {
    if (!signedIn || !q) return;
    const qid = q.questionId;
    const has = account.favorites.includes(qid);
    setAccount((a) => ({ ...a, favorites: has ? a.favorites.filter((x) => x !== qid) : [...a.favorites, qid] }));
    persist(has ? 'unfavorite' : 'favorite', qid);
  }
  function hideCard() {
    if (!signedIn || !q) return;
    const qid = q.questionId;
    setAccount((a) => ({ ...a, hidden: [...a.hidden, qid], favorites: a.favorites.filter((x) => x !== qid) }));
    persist('hide', qid);
    next();
  }

  function choose(letter) {
    if (picked) return;
    setPicked(letter);
    recordAnswer(q.questionId, letter === q.correct);
  }
  function next() {
    setPicked(null);
    setRevealed(false);
    setZoom(false);
    setZNatural(false);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else setIdx(questions.length);
  }

  if (idx >= questions.length) {
    return (
      <div className="card center">
        <h2>{flip ? 'Done flipping 🎉' : 'Set complete 🎉'}</h2>
        <p className="muted">You went through {questions.length} image{questions.length > 1 ? 's' : ''}.</p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => { setIdx(0); setPicked(null); setRevealed(false); }}>Restart</button>
          <Link href="/study" className="btn secondary">Choose another set</Link>
        </div>
      </div>
    );
  }

  const ProgressHeader = (
    <div>
      <div className="progress-top">
        <span>{flip ? 'Image' : 'Question'} {idx + 1} of {questions.length}</span>
        {signedIn && (
          <button className="fav" title={isFav ? 'Unfavorite' : 'Favorite'} onClick={toggleFav}>
            {isFav ? '★' : '☆'}
          </button>
        )}
      </div>
      <div className="bar"><div style={{ width: `${(idx / questions.length) * 100}%` }} /></div>
    </div>
  );

  const Image = q.imageUrl ? (
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
    <div className="q-image-missing">
      Image not yet attached for this question.<br />
      <span className="muted">(Add it via the upload page to display it here.)</span>
    </div>
  );

  const closeZoom = () => { setZoom(false); setZNatural(false); };
  const Zoom = zoom && q.imageUrl && (
    <div onClick={closeZoom}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 50, overflow: 'auto' }}>
      <button onClick={(e) => { e.stopPropagation(); closeZoom(); }}
        style={{ position: 'fixed', top: 12, right: 14, zIndex: 52, background: 'rgba(255,255,255,.16)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '.95rem' }}>✕ Close</button>
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={q.imageUrl} alt={q.imageAlt || ''}
          onClick={(e) => { e.stopPropagation(); setZNatural((n) => !n); }}
          style={{ display: 'block',
            maxWidth: zNatural ? 'none' : '100%',
            maxHeight: zNatural ? 'none' : '92vh',
            cursor: zNatural ? 'zoom-out' : 'zoom-in' }} />
      </div>
      <div style={{ position: 'fixed', bottom: 10, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.7)',
        fontSize: '.78rem', pointerEvents: 'none' }}>
        Tap image to {zNatural ? 'fit to screen' : 'zoom to full size'} · scroll / drag to pan · tap background to close
      </div>
    </div>
  );

  // Logged-in-only card actions: favorite + don't-show-again.
  const AccountActions = signedIn ? (
    <>
      <button className="btn secondary" onClick={toggleFav}>{isFav ? '★ Favorited' : '☆ Favorite'}</button>
      <button className="btn ghost" onClick={hideCard} title="Hide this card from your deck across your devices">
        Don’t show again
      </button>
    </>
  ) : null;

  // ---------- FLIP MODE: image -> reveal finding -> next ----------
  if (flip) {
    return (
      <div className="q-wrap">
        {ProgressHeader}
        {Image}
        {revealed ? (
          <div className="explain reveal">
            <h4>{q.diagnosis || q.title.replace(/^\[DRAFT\]\s*/, '')}</h4>
            {q.teachingPoint && <div className="teach"><strong>What to see:</strong> {q.teachingPoint}</div>}
            <div className="chips">
              {q.category && <span className="chip">{q.category}</span>}
              {q.imageType && <span className="chip">{q.imageType}</span>}
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={next}>{idx + 1 < questions.length ? 'Next image →' : 'Finish'}</button>
              {AccountActions}
            </div>
          </div>
        ) : (
          <button className="btn" onClick={() => setRevealed(true)}>Reveal finding</button>
        )}
        {Zoom}
      </div>
    );
  }

  // ---------- QUIZ MODE ----------
  const correct = picked && picked === q.correct;
  return (
    <div className="q-wrap">
      {ProgressHeader}
      {Image}

      {q.stem && <p className="stem">{q.stem}</p>}
      {q.leadIn && <p className="lead-in">{q.leadIn}</p>}

      <div className="options">
        {LETTERS.map((L) => {
          let cls = 'opt';
          if (picked) {
            if (L === q.correct) cls += ' correct';
            else if (L === picked) cls += ' wrong';
          }
          return (
            <button key={L} className={cls} disabled={!!picked} onClick={() => choose(L)}>
              <span className="letter">{L}</span>
              <span>{q.options[L]}</span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className={`explain ${correct ? 'correct' : 'wrong'}`}>
          <h4>{correct ? 'Correct' : `Not quite — the answer is ${q.correct}`}</h4>
          {q.explanation && <p style={{ margin: 0 }}>{q.explanation}</p>}
          {q.teachingPoint && (
            <div className="teach"><strong>What to see:</strong> {q.teachingPoint}</div>
          )}
          {q.mnemonic && <p className="mnemonic">💡 {q.mnemonic}</p>}
          <div className="chips">
            {q.category && <span className="chip">{q.category}</span>}
            {q.imageType && <span className="chip">{q.imageType}</span>}
            {q.difficulty && <span className="chip">{q.difficulty}</span>}
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={next}>
              {idx + 1 < questions.length ? 'Next question →' : 'Finish'}
            </button>
            {AccountActions}
          </div>
        </div>
      )}

      {Zoom}
    </div>
  );
}
