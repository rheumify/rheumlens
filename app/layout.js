import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'RheumLens — Free Rheumatology Image Practice',
  description:
    'A free, image-based rheumatology question bank. Practice recognizing the clinical images that matter — crystals, rashes, radiographs, ultrasound, and more.',
};

const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }) {
  const body = (
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

  // Only mount ClerkProvider when keys exist; otherwise the app is fully anonymous.
  if (hasClerk) {
    const { ClerkProvider } = require('@clerk/nextjs');
    return <ClerkProvider>{body}</ClerkProvider>;
  }
  return body;
}
