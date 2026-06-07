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

function Shell({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="container">{children}</main>
        <footer className="site-footer">
          <p>
            Images courtesy of the ACR Rheumatology Image Library. Copyright ACR.
            Used with permission for non-commercial educational purposes.
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
