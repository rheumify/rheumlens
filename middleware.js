// Clerk is OPTIONAL. If keys are not set, this middleware is a no-op so the app
// runs fully anonymous. When Clerk keys exist, clerkMiddleware enables sessions
// (it does NOT gate any route — login only ever adds optional progress sync).
import { clerkMiddleware } from '@clerk/nextjs/server';

const hasClerk =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export default hasClerk ? clerkMiddleware() : function middleware() {};

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
