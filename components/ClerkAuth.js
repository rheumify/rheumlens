'use client';
// Rendered only when Clerk keys exist (see Nav). Sign-in is OPTIONAL and only
// adds cloud-synced progress — it never gates access to any question.
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';

export default function ClerkAuth() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="btn ghost" style={{ fontWeight: 600 }}>Save progress</button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </>
  );
}
