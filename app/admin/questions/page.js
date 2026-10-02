'use client';
import { useState } from 'react';

// Proposed questions — the quiz items Claude has drafted on ⭐ Create Question cards.
//
// /admin/review deliberately shows only the flip-card side of a record (image +
// Diagnosis + "What to see"), so a drafted question is invisible there. This page
// is the other half: it renders the stem, lead-in, the four options with the keyed
// answer marked, the explanation and the mnemonic, so each item can be read as a
// learner would meet it and approved or sent back.
//
// Nothing here is live. Quiz mode sits behind QUIZ_ENABLED = false, so these items
// render to no one until that flag flips.

const LETTERS = ['A', 'B', 'C', 'D'];

export default function ProposedQuestionsPage() {
  const [secret, setSecret] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [comments, setComments] = useState({});
  const [commentBusy, setCommentBusy] = useState(null);
  const [commentSaved, setCommentSaved] = useState(null);

  async function load() {
    setBusy(true); setError(null); setItems(null); setCommentSaved(null);
    try {
      const res = await fetch('/api/admin/review?scope=proposed', {
        headers: { 'x-admin-secret': secret },
        cache: 'no-store',
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Load failed (${res.status})`); }
      if (!res.ok) throw new Error(data.error || `Load failed (${res.status})`);
      setItems(data.records);
      setComments(Object.fromEntries((data.records || []).map((r) => [r.id, r.reviewComment || ''])));
      setRevealed({});
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  // Same channel as the review queue: the comment lands in Review Comment and the
  // next Claude session reads it, makes the edit, and clears it.
  async function saveComment(id) {
    setCommentBusy(id); setError(null); setCommentSaved(null);
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, comment: comments[id] ?? '' }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Save failed (${res.status})`); }
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, reviewComment: comments[id] ?? '' } : x)));
      setCommentSaved(id);
    } catch (e) { setError(e.message); }
    finally { setCommentBusy(null); }
  }

  const chip = {
    display: 'inline-block', fontSize: '.72rem', fontWeight: 600, padding: '2px 8px',
    borderRadius: 999, background: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-600, #475569)', marginRight: 6,
  };

  function optionRow(r, letter, text) {
    if (!text) return null;
    const isKey = String(r.correctAnswer).trim().toUpperCase() === letter;
    const show = revealed[r.id];
    return (
      <div key={letter} style={{
        display: 'flex', gap: 10, padding: '7px 10px', borderRadius: 8,
        border: '1px solid ' + (show && isKey ? '#86efac' : 'var(--slate-200, #e2e8f0)'),
        background: show && isKey ? '#f0fdf4' : 'transparent',
      }}>
        <span style={{ fontWeight: 700, minWidth: 18, color: show && isKey ? '#166534' : 'inherit' }}>{letter}</span>
        <span style={{ flex: 1 }}>{text}</span>
        {show && isKey && <span style={{ fontWeight: 700, color: '#166534' }}>✓</span>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Proposed questions</h1>
      <p className="muted">
        The quiz items drafted on <b>⭐ Create a question</b> cards. The review queue only ever
        shows the flip side of a card, so this is where the written question itself lives — stem,
        lead-in, four options, the keyed answer, explanation and mnemonic. Read each one the way a
        learner would meet it, hit <b>Show answer</b> to check the key, and leave a <b>comment</b> on
        anything that needs changing — the next Claude session reads it, makes the edit, and clears it.
        Nothing here is live: quiz mode is still behind the <code>QUIZ_ENABLED</code> flag.
        Starred cards with no question written yet stay in <a href="/admin/review">the review queue</a>
        {' '}under <b>Load question candidates ⭐</b>.
      </p>

      <div className="card" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_UPLOAD_SECRET"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300, #cbd5e1)' }} />
        </label>
        <div className="btn-row">
          <button className="btn" disabled={busy || !secret} onClick={load}>
            {busy ? 'Loading…' : 'Load proposed questions'}
          </button>
        </div>
      </div>

      {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      {items && items.length === 0 && (
        <div className="card">
          <strong>No drafted questions yet.</strong> Star an image with <b>⭐ Create a question</b> in
          the review queue, then ask Claude to write questions for the starred set.
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>{items.length} proposed question(s)</div>
          <div style={{ display: 'grid', gap: 16 }}>
            {items.map((r) => (
              <div key={r.id} className="card" style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.title || r.qid}</div>
                  <div className="muted" style={{ fontSize: '.85rem', marginBottom: 8 }}>{r.qid}</div>
                  <div>
                    {r.category && <span style={chip}>{r.category}</span>}
                    {r.imageType && <span style={chip}>{r.imageType}</span>}
                    {r.difficulty && <span style={chip}>{r.difficulty}</span>}
                  </div>
                </div>

                {r.image && (
                  <a href={r.image} target="_blank" rel="noreferrer">
                    <img src={r.image} alt={r.title}
                      style={{ width: '100%', maxWidth: 420, borderRadius: 8, border: '1px solid var(--slate-200, #e2e8f0)', background: '#000' }} />
                  </a>
                )}

                {r.stem && <div style={{ lineHeight: 1.5 }}>{r.stem}</div>}
                {r.leadIn && <div style={{ fontWeight: 600 }}>{r.leadIn}</div>}

                <div style={{ display: 'grid', gap: 6 }}>
                  {optionRow(r, 'A', r.optionA)}
                  {optionRow(r, 'B', r.optionB)}
                  {optionRow(r, 'C', r.optionC)}
                  {optionRow(r, 'D', r.optionD)}
                </div>

                <div className="btn-row">
                  <button className="btn secondary"
                    onClick={() => setRevealed((p) => ({ ...p, [r.id]: !p[r.id] }))}>
                    {revealed[r.id] ? 'Hide answer' : 'Show answer'}
                  </button>
                  <a className="btn secondary" href={r.airtableUrl} target="_blank" rel="noreferrer">Edit in Airtable</a>
                  {r.qid && (
                    <a className="btn secondary" href={`/card/${encodeURIComponent(r.qid)}`} target="_blank" rel="noreferrer">
                      View card
                    </a>
                  )}
                </div>

                {revealed[r.id] && (
                  <div style={{ display: 'grid', gap: 10, paddingTop: 4, borderTop: '1px solid var(--slate-200, #e2e8f0)' }}>
                    {r.correctAnswer && (
                      <div><strong>Answer:</strong> {r.correctAnswer}</div>
                    )}
                    {r.explanation && (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Explanation</div>
                        <div style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.explanation}</div>
                      </div>
                    )}
                    {r.mnemonic && (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Mnemonic</div>
                        <div style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.mnemonic}</div>
                      </div>
                    )}
                    {r.teachingPoint && (
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Flip-card teaching point</div>
                        <div className="muted" style={{ lineHeight: 1.55 }}>{r.teachingPoint}</div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Comment for Claude</div>
                  <textarea
                    value={comments[r.id] ?? ''}
                    onChange={(e) => setComments((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="e.g. make the stem shorter, swap option C, the key should be B"
                    rows={2}
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300, #cbd5e1)', fontFamily: 'inherit' }} />
                  <div className="btn-row" style={{ marginTop: 6 }}>
                    <button className="btn secondary" disabled={commentBusy === r.id} onClick={() => saveComment(r.id)}>
                      {commentBusy === r.id ? 'Saving…' : 'Save comment'}
                    </button>
                    {commentSaved === r.id && <span className="muted" style={{ alignSelf: 'center' }}>Saved ✓</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
