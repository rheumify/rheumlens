import Link from 'next/link';
import ClerkAuth from './ClerkAuth';

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">Rheum</span><span className="brand-lens">Lens</span>
        </Link>
        <div className="nav-actions">
          <Link href="/study">Practice</Link>
          {hasClerk && <ClerkAuth />}
        </div>
      </div>
    </nav>
  );
}
