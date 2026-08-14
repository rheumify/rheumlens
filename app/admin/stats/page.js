'use client';
import { useState } from 'react';

// Admin-only dashboard for the numbers behind RheumLens: account signups from
// Clerk and the content library from Airtable. Gated by ADMIN_UPLOAD_SECRET,
// same as /admin/upload and /admin/review. Traffic lives in Vercel Analytics.

const BRAND = '#7B6B9E';
const TEAL = '#3D8FA3';

function Stat({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'grid', gap: 2 }}>
      <div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1, color: accent || 'inherit' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: '.8rem' }}>{sub}</div>}
    </div>
  );
}

function Bars({ data, accent = BRAND, format }) {
  const rows = Object.entries(data || {});
  if (!rows.length) return <div className="muted" style={{ fontSize: '.85rem' }}>No data yet.</div>;
  const max = Math.max(...rows.map(([, v]) => (typeof v === 'number' ? v : v.published + v.draft)));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map(([k, v]) => {
        const pub = typeof v === 'number' ? v : v.published;
        const draft = typeof v === 'number' ? 0 : v.draft;
        const total = pub + draft;
        return (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 88px', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</div>
            <div style={{ display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden', background: 'var(--slate-100, #f1f5f9)' }}>
              <div style={{ width: `${(pub / max) * 100}%`, background: accent }} />
              {draft > 0 && <div style={{ width: `${(draft / max) * 100}%`, background: accent, opacity: 0.28 }} />}
            </div>
            <div className="muted" style={{ fontSize: '.8rem', textAlign: 'right' }}>
              {format ? format(v) : (draft ? `${pub} + ${draft} draft` : total)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminStats() {
  const [secret, setSecret] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-secret': secret } });
      const raw = await res.text();
      let json;
      try { json = JSON.parse(raw); } catch { throw new Error(`Failed (${res.status}): ${raw.slice(0, 120)}`); }
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const a = data?.accounts;
  const c = data?.content;

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Stats</h1>
      <p className="muted">
        Signups and saved progress come from <b>Clerk</b>; the content library comes from <b>Airtable</b>.
        Visits and pageviews are tracked separately in <b>Vercel Web Analytics</b>. Admin only.
      </p>

      <div className="card" style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin secret</div>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && secret) load(); }}
            placeholder="ADMIN_UPLOAD_SECRET"
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--slate-300, #cbd5e1)' }} />
        </label>
        <div className="btn-row">
          <button className="btn" disabled={busy || !secret} onClick={load}>
            {busy ? 'Loading…' : data ? 'Refresh' : 'Load stats'}
          </button>
        </div>
      </div>

      {error && <div className="banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      {data && (
        <div style={{ display: 'grid', gap: 22 }}>

          {/* ---------------------------------------------------- Accounts */}
          <section>
            <h2 style={{ marginBottom: 10 }}>Accounts</h2>
            {!a?.enabled ? (
              <div className="card">
                <strong>Accounts are off on this deployment.</strong>
                <div className="muted" style={{ marginTop: 4 }}>{a?.note || a?.error}</div>
              </div>
            ) : a?.error ? (
              <div className="banner-error">{a.error}</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <Stat label="Total signups" value={a.totalUsers} accent={BRAND}
                    sub={a.lastSignupAt ? `latest ${new Date(a.lastSignupAt).toLocaleDateString()}` : null} />
                  <Stat label="Last 7 days" value={a.signups.last7} />
                  <Stat label="Last 30 days" value={a.signups.last30} />
                  <Stat label="Saved something" value={a.engagement.accountsWithSavedProgress} accent={TEAL}
                    sub={`${a.engagement.totalFavorites} favorites · ${a.engagement.totalHidden} hidden`} />
                </div>

                {Object.keys(a.signupsByMonth || {}).length > 0 && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Signups by month</div>
                    <Bars data={a.signupsByMonth} accent={BRAND} format={(v) => v} />
                  </div>
                )}

                {a.topFavorited?.length > 0 && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Most-favorited cards</div>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {a.topFavorited.map((f) => (
                        <div key={f.questionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.88rem' }}>
                          <a href={`/card/${encodeURIComponent(f.questionId)}`} target="_blank" rel="noreferrer">{f.questionId}</a>
                          <span className="muted">{f.count} ★</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {a.totalUsers === 0 && (
                  <div className="muted" style={{ fontSize: '.85rem', marginTop: 10 }}>
                    No one has signed up yet — expected, since the whole deck works anonymously and
                    sign-in only adds cross-device sync.
                  </div>
                )}
              </>
            )}
          </section>

          {/* ----------------------------------------------------- Content */}
          <section>
            <h2 style={{ marginBottom: 10 }}>Content library</h2>
            {c?.error ? <div className="banner-error">{c.error}</div> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  <Stat label="Published (live)" value={c.published} accent={BRAND} sub={`${c.totalCards} cards total`} />
                  <Stat label="Draft" value={c.draft} sub="not visible to learners" />
                  <Stat label="Flagged for review" value={c.queues.needsReview} accent={c.queues.needsReview ? '#b45309' : undefined} />
                  <Stat label="Question candidates ⭐" value={c.queues.createQuestion} accent={TEAL} />
                </div>

                {c.queues.openReviewComments > 0 && (
                  <div className="card" style={{ marginTop: 12, borderColor: '#bfdbfe', background: '#eff6ff' }}>
                    <strong>{c.queues.openReviewComments} open comment(s) for Claude</strong>
                    <div className="muted" style={{ marginTop: 2 }}>Waiting to be actioned in the next session.</div>
                  </div>
                )}

                <div className="card" style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>By topic <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem' }}>(solid = published, faded = draft)</span></div>
                  <Bars data={c.byCategory} accent={BRAND} />
                </div>

                <div className="card" style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Published by image type</div>
                  <Bars data={c.publishedByImageType} accent={TEAL} />
                </div>

                {Object.keys(c.publishedByJoint || {}).length > 0 && (
                  <div className="card" style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      Published by joint / region <span className="muted" style={{ fontWeight: 400, fontSize: '.8rem' }}>(non-joint images are intentionally blank)</span>
                    </div>
                    <Bars data={c.publishedByJoint} accent={TEAL} />
                  </div>
                )}
              </>
            )}
          </section>

          {/* ----------------------------------------------------- Traffic */}
          <section>
            <h2 style={{ marginBottom: 10 }}>Traffic</h2>
            <div className="card">
              Visits and pageviews are collected by Vercel Web Analytics (the <code>&lt;Analytics /&gt;</code> tag
              in the app layout).{' '}
              <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Open the Vercel dashboard ↗</a>{' '}
              → <b>rheumlens</b> → <b>Analytics</b>.
            </div>
          </section>

          <div className="muted" style={{ fontSize: '.78rem' }}>
            Generated {new Date(data.generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
