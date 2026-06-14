'use client';
import { useState } from 'react';

export default function AdminReview() {
  const [secret, setSecret] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/review', { headers: { 'x-admin-secret': secret } });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Failed (${res.status}): ${raw.slice(0, 120)}`); }
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setItems(data.records);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function resolve(id) {
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
    } catch { /* ignore */ }
  }

  const chip = {
    display: 'inline-block', fontSize: '.72rem', fontWeight: 600, padding: '2px 8px',
    borderRadius: 999, background: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-600, #475569)', marginRight: 6,
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Review queue</h1>
      <p className="muted">
        Records Claude flagged with a question or uncertainty (the <b>Needs Review</b> box in Airtable).
        Each shows the image, what Claude is unsure about, and a link to edit the record. Admin only.
      </p>

      <div className="card" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_UPLOAD_SECRET"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300, #cbd5e1)' }} />
        </label>
        <button className="btn" disabled={busy || !secret} onClick={load}>
          {busy ? 'Loading…' : 'Load review queue'}
        </button>
      </div>

      {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      {items && items.length === 0 && (
        <div className="card"><strong>Nothing to review</strong> — the queue is empty. 🎉</div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>{items.length} flagged record(s)</div>
          <div style={{ display: 'grid', gap: 16 }}>
            {items.map((r) => (
              <div key={r.id} className="card" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {r.image && (
                    <a href={r.image} target="_blank" rel="noreferrer">
                      <img src={r.image} alt={r.title}
                        style={{ width: 220, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--slate-200, #e2e8f0)', background: '#000' }} />
                    </a>
                  )}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700 }}>{r.title || r.qid}</div>
                    <div className="muted" style={{ fontSize: '.85rem', marginBottom: 8 }}>{r.qid}</div>
                    <div>
                      {r.category && <span style={chip}>{r.category}</span>}
                      {r.imageType && <span style={chip}>{r.imageType}</span>}
                      {r.difficulty && <span style={chip}>{r.difficulty}</span>}
                      <span style={{ ...chip, background: r.published ? '#dcfce7' : '#fef9c3', color: r.published ? '#166534' : '#854d0e' }}>
                        {r.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                  </div>
                </div>

                {r.claudeQuestion && (
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.03em', color: '#9a3412', marginBottom: 4 }}>
                      Claude&apos;s question
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{r.claudeQuestion}</div>
                  </div>
                )}

                {r.notes && (
                  <div className="muted" style={{ fontSize: '.85rem' }}>
                    <b>Your upload note:</b> {r.notes}
                  </div>
                )}

                {r.sourceCaption && (
                  <details>
                    <summary className="muted" style={{ cursor: 'pointer', fontSize: '.85rem' }}>ACR caption</summary>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '.85rem', marginTop: 6 }}>{r.sourceCaption}</div>
                  </details>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a className="btn secondary" href={r.airtableUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px' }}>
                    Edit in Airtable ↗
                  </a>
                  <button className="btn ghost" onClick={() => resolve(r.id)} style={{ padding: '6px 12px' }}>
                    Mark resolved
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
