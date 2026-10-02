'use client';
import { useState } from 'react';

// Report an issue with one card.
//
// One free text box, no category dropdown. These images carry teaching points
// written from ACR captions, and the errors worth catching (wrong side, wrong
// joint, wrong diagnosis, a caption that doesn't match its image) don't fit a
// fixed list — a dropdown would just make people pick the nearest wrong label
// and stop typing. Submissions land in the Image Reports table and surface in
// Ali's morning briefing.
//
// Collapsed by default and styled quietly: it should be findable when something
// is wrong and invisible the rest of the time.

export default function ReportIssue({ questionId, title, recordId }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          title,
          recordId,
          message: text,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send that.');
      setDone(true);
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="muted" style={{ fontSize: '.82rem', marginTop: 10 }}>
        Thanks — that went to Ali. She reads these.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          fontSize: '.82rem',
          color: 'var(--slate-500, #64748b)',
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          cursor: 'pointer',
        }}
      >
        Report an issue with this image
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12, display: 'grid', gap: 8 }}>
      <label style={{ fontSize: '.82rem', fontWeight: 600 }}>
        What&apos;s wrong with this card?
      </label>
      <textarea
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Anything — a wrong side or joint, a diagnosis you disagree with, an image that doesn't match its caption, a typo."
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: '1.5px solid var(--slate-300, #cbd5e1)',
          fontFamily: 'inherit',
          fontSize: '.9rem',
          resize: 'vertical',
        }}
      />
      {error && (
        <div style={{ fontSize: '.82rem', color: '#b91c1c' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn secondary" type="submit" disabled={busy || !message.trim()} style={{ padding: '5px 12px' }}>
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          style={{ background: 'none', border: 'none', font: 'inherit', fontSize: '.82rem', color: 'var(--slate-500, #64748b)', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
      <div className="muted" style={{ fontSize: '.75rem' }}>
        Goes straight to Ali with the card ID. No account needed.
      </div>
    </form>
  );
}
