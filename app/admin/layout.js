// Shared nav for the admin screens. There are four of them now and no other way
// to move between them — /admin/questions especially, which is otherwise only
// reachable by typing the URL.

const TABS = [
  { href: '/admin/upload', label: 'Upload' },
  { href: '/admin/review', label: 'Review queue' },
  { href: '/admin/questions', label: 'Proposed questions' },
  { href: '/admin/stats', label: 'Stats' },
];

export default function AdminLayout({ children }) {
  return (
    <>
      <nav style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18,
        paddingBottom: 12, borderBottom: '1px solid var(--slate-200, #e2e8f0)',
      }}>
        {TABS.map((t) => (
          <a key={t.href} href={t.href} style={{
            fontSize: '.85rem', fontWeight: 600, textDecoration: 'none',
            padding: '5px 11px', borderRadius: 999,
            border: '1px solid var(--slate-200, #e2e8f0)',
            background: 'var(--slate-100, #f8fafc)',
            color: 'var(--slate-600, #475569)',
          }}>
            {t.label}
          </a>
        ))}
      </nav>
      {children}
    </>
  );
}
