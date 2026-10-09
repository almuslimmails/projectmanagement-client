// Redirects unauthenticated *page* requests to /sign-in.
//
// Auth moved to JWTs held client-side (tracker-api verifies signatures).
// Middleware can't read localStorage, so sign-in mirrors a `tracker_token`
// presence cookie; its absence means "not signed in" for page-gating
// purposes. This is a UX redirect only — data security lives in the API.

import { NextResponse, type NextRequest } from 'next/server'

// /ai/* is bundled static content (public/ai/*) — served without auth because
// the in-app AIDocView iframes fetch it regardless of who's viewing.
const PUBLIC_PAGES = /^\/(sign-in|_next|favicon\.ico|ai\/)/

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // API routes (the few legacy ones left) manage their own responses.
  if (pathname.startsWith('/api')) return
  if (PUBLIC_PAGES.test(pathname)) return
  if (req.cookies.get('tracker_token')) return
  const signIn = new URL('/sign-in', req.nextUrl)
  signIn.searchParams.set('next', pathname)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
