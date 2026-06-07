'use client';
import { useState } from 'react';

export default function AdminUpload() {
  const [secret, setSecret] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  async function upload() {
    setBusy(true); setError(null); setResults(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/admin/upload', { method: 'POST', headers: { 'x-admin-secret': secret }, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      setResults(data);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <h1>Image upload</h1>
      <p className="muted">
        Drop in images named by Question ID (e.g. <code>RL-001.jpg</code>, or <code>RL-001_anything.jpg</code>).
        Each is hosted and attached to its matching question automatically.
      </p>

      <div className="card" style={{ display: 'grid', gap: 14 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_UPLOAD_SECRET" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300)' }} />
        </label>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Images (select many, or a whole folder)</div>
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
        </label>
        {files.length > 0 && <div className="muted">{files.length} file(s) selected</div>}
        <button className="btn" disabled={busy || !files.length || !secret} onClick={upload}>
          {busy ? 'Uploading…' : `Upload ${files.length || ''} image(s)`}
        </button>
      </div>

      {error && <div className="banner-error" style={{ marginTop: 14 }}>{error}</div>}

      {results && (
        <div className="card" style={{ marginTop: 14 }}>
          <strong>{results.attached} of {results.total} attached</strong>
          <ul>
            {results.results.map((r, i) => (
              <li key={i}>
                {r.file} → <b>{r.status}</b>{r.qid ? ` (${r.qid})` : ''}{r.error ? `: ${r.error}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
