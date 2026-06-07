'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recordAnswer, toggleFavorite, isFavorite, getFavorites, getMissedIds } from '@/lib/progress';

const PREVIEW = process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
const LETTERS = ['A', 'B', 'C', 'D'];

export default function QuestionSession({ mode = 'random', category = null, style = 'quiz' }) {
  const flip = style === 'flip';
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [fav, setFav] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const url = new URL('/api/questions', window.location.origin);
    if (category) url.searchParams.set('category', category);
    if (PREVIEW) url.searchParams.set('preview', 'true');
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        let qs = data.questions || [];
        if (mode === 'favorites') {
          const ids = new Set(getFavorites());
          qs = qs.filter((q) => ids.has(q.questionId));
        } else if (mode === 'missed') {
          const ids = new Set(getMissedIds());
          qs = qs.filter((q) => ids.has(q.questionId));
        }
        setQuestions(qs);
        if (data.error) setError(data.error);
      })
      .catch((e) => setError(e.message));
  }, [mode, category]);

  const q = questions && questions[idx];
  useEffect(() => { if (q) setFav(isFavorite(q.questionId)); }, [q]);

  if (error && !questions?.length) return <div className="banner-error">Could not load questions: {error}</div>;
  if (!questions) return <p className="center muted">Loading…</p>;
  if (!questions.length) {
    return (
      <div className="card center">
        <p>No questions here yet.</p>
        <Link href="/study" className="btn secondary">Back to practice</Link>
      </div>
    );
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
        <button className="fav" title="Favorite" onClick={() => setFav(toggleFavorite(q.questionId))}>
          {fav ? '★' : '☆'}
        </button>
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
      <div className="credit">{q.credit}</div>
    </div>
  ) : (
    <div className="q-image-missing">
      Image not yet attached for this question.<br />
      <span className="muted">(Add it via the upload page to display it here.)</span>
    </div>
  );

  const Zoom = zoom && q.imageUrl && (
    <div
      onClick={() => setZoom(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={q.imageUrl} alt={q.imageAlt || ''} style={{ maxWidth: '100%', maxHeight: '100%' }} />
    </div>
  );

  // ---------- FLIP MODE: image -> reveal finding -> next ----------
  if (flip) {
    return (
      <div className="q-wrap">
        {ProgressHeader}
        {Image}
        {revealed ? (
          <div className="explain correct">
            <h4>{q.diagnosis || q.title.replace(/^\[DRAFT\]\s*/, '')}</h4>
            {q.teachingPoint && <div className="teach"><strong>What to see:</strong> {q.teachingPoint}</div>}
            <div className="chips">
              {q.category && <span className="chip">{q.category}</span>}
              {q.imageType && <span className="chip">{q.imageType}</span>}
            </div>
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={next}>{idx + 1 < questions.length ? 'Next image →' : 'Finish'}</button>
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
          </div>
        </div>
      )}

      {Zoom}
    </div>
  );
}
