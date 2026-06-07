'use client';
import { useState } from 'react';

const IMG_RE = /\.(jpe?g|png|gif|webp|tiff?)$/i;

// Collect image files from a drop, walking into any dropped folders.
async function gatherFiles(dataTransfer) {
  const items = dataTransfer.items;
  if (items && items.length && items[0] && items[0].webkitGetAsEntry) {
    const entries = [];
    for (const it of items) {
      const e = it.webkitGetAsEntry && it.webkitGetAsEntry();
      if (e) entries.push(e);
    }
    const out = [];
    async function walk(entry) {
      if (entry.isFile) {
        await new Promise((res) => entry.file((f) => { out.push(f); res(); }, res));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const read = () => new Promise((res) => reader.readEntries(res, () => res([])));
        let batch;
        do { batch = await read(); for (const c of batch) await walk(c); } while (batch.length);
      }
    }
    for (const e of entries) await walk(e);
    return out.filter((f) => IMG_RE.test(f.name));
  }
  return Array.from(dataTransfer.files || []).filter((f) => IMG_RE.test(f.name));
}

export default function AdminUpload() {
  const [secret, setSecret] = useState('');
  const [files, setFiles] = useState([]);
  const [info, setInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  function mergeFiles(incoming) {
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...incoming.filter((f) => !seen.has(f.name + f.size))];
    });
  }

  async function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = await gatherFiles(e.dataTransfer);
    if (dropped.length) mergeFiles(dropped);
    else setError('No image files found in what you dropped (jpg/png/gif/webp/tif).');
  }

  async function upload() {
    setBusy(true); setError(null); setResults(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      if (info.trim()) fd.append('info', info);
      if (notes.trim()) fd.append('notes', notes);
      const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-secret': secret }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setResults(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const taStyle = { width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300)', fontFamily: 'inherit', fontSize: '.9rem' };

  return (
    <div style={{ maxWidth: 620 }}>
      <h1>Image upload</h1>
      <p className="muted">
        Name files by their ACR reference number (e.g. <code>99-14-0055.tif</code>) or by Question ID
        (<code>RL-001.jpg</code>). Paste the ACR info below and a new draft question is created for each new image.
      </p>

      <div className="card" style={{ display: 'grid', gap: 14 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_UPLOAD_SECRET" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300)' }} />
        </label>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--indigo)' : 'var(--slate-300)'}`,
            background: dragging ? 'var(--indigo-light)' : 'var(--slate-50)',
            borderRadius: 12, padding: '28px 16px', textAlign: 'center', transition: 'all .12s',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Drag images or a folder here</div>
          <div className="muted" style={{ fontSize: '.9rem', marginBottom: 10 }}>jpg, png, gif, webp, tif · TIFs are auto-converted · folders are walked</div>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            …or choose files
            <input type="file" accept="image/*,.tif,.tiff" multiple style={{ display: 'none' }}
              onChange={(e) => mergeFiles(Array.from(e.target.files).filter((f) => IMG_RE.test(f.name)))} />
          </label>
        </div>

        {files.length > 0 && (
          <div className="muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{files.length} file(s) ready</span>
            <button className="btn ghost" style={{ padding: '2px 8px' }} onClick={() => setFiles([])}>clear</button>
          </div>
        )}

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>ACR image info (optional)</div>
          <div className="muted" style={{ fontSize: '.85rem', marginBottom: 6 }}>
            Paste one or more ACR blocks (Category / Reference # / Image Title / Description). Each new
            Reference # becomes a draft question with the image attached.
          </div>
          <textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={7}
            placeholder={'Category\tCrystal Associated Arthropathies\nReference #\t99-14-0055\nImage Title\t...\nDescription\t...'}
            style={taStyle} />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Comments / notes (optional)</div>
          <div className="muted" style={{ fontSize: '.85rem', marginBottom: 6 }}>
            Anything specific about the image — what to emphasize, how to frame the question, gotchas.
            Saved to the record(s) in this upload for Claude to use when writing the question.
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
            placeholder="e.g. focus on the double-contour sign; or: this is a tough one, make it Level 3"
            style={taStyle} />
        </label>

        <button className="btn" disabled={busy || !files.length || !secret} onClick={upload}>
          {busy ? 'Uploading…' : `Upload ${files.length || ''} image(s)`}
        </button>
      </div>

      {error && <div className="banner-error" style={{ marginTop: 14 }}>{error}</div>}

      {results && (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>{results.attached} of {results.total} attached{results.created ? ` · ${results.created} new draft(s)` : ''}</strong>
          <ul>
            {results.results.map((r, i) => (
              <li key={i}>
                {r.file} → <b>{r.status}</b>{r.created ? ' (new)' : ''}{r.qid ? ` (${r.qid})` : ''}{r.error ? `: ${r.error}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
