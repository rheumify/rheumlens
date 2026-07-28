import './globals.css';
import Nav from '@/components/Nav';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'RheumLens — Free Rheumatology Image Practice',
  description:
    'A free, image-based rheumatology question bank. Practice recognizing the clinical images that matter — crystals, rashes, radiographs, ultrasound, and more.',
};

// This app reads live data; render dynamically to avoid prerender issues with Clerk.
export const dynamic = 'force-dynamic';

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Set theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{var t=localStorage.getItem('rl-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

function Shell({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Nav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          <p>
            Images courtesy of the ACR Rheumatology Image Library. Copyright ACR.
            Used with permission for non-commercial educational purposes.
          </p>
          <p className="muted">
            RheumLens is an independent educational project. It is not affiliated with, produced by,
            or endorsed by the American College of Rheumatology (ACR).
          </p>
          <p className="muted">RheumLens is a free educational resource. No ads. No sign-up required.</p>
        </footer>
      </body>
    </html>
  );
}

export default function RootLayout({ children }) {
  // Only wrap in ClerkProvider when keys exist; otherwise the app is fully anonymous.
  if (hasClerk) {
    return (
      <ClerkProvider>
        <Shell>{children}</Shell>
      </ClerkProvider>
    );
  }
  return <Shell>{children}</Shell>;
}
