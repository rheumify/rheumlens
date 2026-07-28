'use client';
import { useState } from 'react';

const MAX_DIM = 2200;
const JPEG_QUALITY = 0.85;

// Downscale + re-encode a jpg/png/webp to JPEG so the request stays small.
// TIFs are passed through unchanged so the server (sharp) converts them.
async function shrinkToJpeg(file) {
  if (/\.tiff?$/i.test(file.name) || (file.type || '').includes('tiff')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new window.Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read image'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY));
    return blob || file;
  } catch { return file; }
  finally { URL.revokeObjectURL(url); }
}

export default function AdminReview() {
  const [secret, setSecret] = useState('');
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [replaceBusy, setReplaceBusy] = useState(null);
  const [scope, setScope] = useState('flagged');

  async function load(which = 'flagged') {
    setBusy(true); setError(null); setScope(which);
    try {
      const url = which === 'all' ? '/api/admin/review?scope=all' : '/api/admin/review';
      const res = await fetch(url, { headers: { 'x-admin-secret': secret } });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Failed (${res.status}): ${raw.slice(0, 120)}`); }
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setItems(data.records);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function publish(id) {
    try {
      const res = await fetch('/api/admin/review', {
        method: 'POST',
        headers: { 'x-admin-secret': secret, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, publish: true }),
      });
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
    } catch { /* ignore */ }
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

  // Replace the image on a record by re-uploading through the existing upload
  // endpoint. Naming the file by Question ID makes it match and swap the attachment.
  async function replaceImage(r, fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    setReplaceBusy(r.id); setError(null);
    try {
      const isTiff = /\.tiff?$/i.test(file.name) || (file.type || '').includes('tiff');
      const body = isTiff ? file : await shrinkToJpeg(file);
      const named = new File([body], `${r.qid}.${isTiff ? 'tif' : 'jpg'}`, {
        type: isTiff ? 'image/tiff' : 'image/jpeg',
      });
      const fd = new FormData();
      fd.append('files', named);
      const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-secret': secret }, body: fd });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Replace failed (${res.status})`); }
      if (!res.ok) throw new Error(data.error || `Replace failed (${res.status})`);
      const r0 = data.results && data.results[0];
      if (r0 && r0.status !== 'attached') throw new Error(`Replace: ${r0.status}${r0.error ? ': ' + r0.error : ''}`);
      await load(scope); // refresh to show the new image
    } catch (e) { setError(e.message); }
    finally { setReplaceBusy(null); }
  }

  const chip = {
    display: 'inline-block', fontSize: '.72rem', fontWeight: 600, padding: '2px 8px',
    borderRadius: 999, background: 'var(--slate-100, #f1f5f9)', color: 'var(--slate-600, #475569)', marginRight: 6,
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Review queue</h1>
      <p className="muted">
        Nothing is visible to users until it&apos;s <b>Published</b>. Drafts and <b>[NEW]</b> uploads
        stay private to this admin screen. Use <b>Flagged</b> for records Claude marked with a question,
        or <b>All unpublished</b> to work through everything not yet live. Each record shows the image and
        its flip answer, and can be published or resolved right here, edited in Airtable, or given a
        replacement image. Admin only.
      </p>

      <div className="card" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_UPLOAD_SECRET"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300, #cbd5e1)' }} />
        </label>
        <div className="btn-row">
          <button className="btn" disabled={busy || !secret} onClick={() => load('flagged')}>
            {busy && scope === 'flagged' ? 'Loading…' : 'Load flagged'}
          </button>
          <button className="btn secondary" disabled={busy || !secret} onClick={() => load('all')}>
            {busy && scope === 'all' ? 'Loading…' : 'Load all unpublished'}
          </button>
        </div>
      </div>

      {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      {items && items.length === 0 && (
        <div className="card"><strong>Nothing to review</strong> — the queue is empty. 🎉</div>
      )}

      {items && items.length > 0 && (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>
            {items.length} {scope === 'all' ? 'unpublished' : 'flagged'} record(s)
          </div>
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
                      {r.needsReview && <span style={{ ...chip, background: '#fef2f2', color: '#991b1b' }}>Flagged</span>}
                    </div>
                  </div>
                </div>

                {(r.diagnosis || r.teachingPoint) && (
                  <div style={{ background: 'var(--brand-bg, #f0edf7)', borderRadius: 8, padding: '10px 12px' }}>
                    {r.diagnosis && <div style={{ fontWeight: 700 }}>{r.diagnosis}</div>}
                    {r.teachingPoint && (
                      <div style={{ fontSize: '.9rem', marginTop: 4 }}><b>What to see:</b> {r.teachingPoint}</div>
                    )}
                  </div>
                )}

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
                  {!r.published && (
                    <button className="btn" onClick={() => publish(r.id)} style={{ padding: '6px 12px' }}>
                      Publish ✓
                    </button>
                  )}
                  <a className="btn secondary" href={r.airtableUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 12px' }}>
                    Edit in Airtable ↗
                  </a>
                  <label className="btn secondary" style={{ padding: '6px 12px', cursor: replaceBusy === r.id ? 'wait' : 'pointer' }}>
                    {replaceBusy === r.id ? 'Replacing…' : 'Replace image'}
                    <input type="file" accept="image/*,.tif,.tiff" style={{ display: 'none' }}
                      disabled={replaceBusy === r.id}
                      onChange={(e) => { replaceImage(r, e.target.files); e.target.value = ''; }} />
                  </label>
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
