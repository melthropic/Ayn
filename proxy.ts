import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, gatePassword, verifySessionToken } from '@/lib/ayn/auth'

// Public paths: the login page and the auth endpoints themselves.
const PUBLIC = new Set(['/login', '/api/auth/login', '/api/auth/logout'])

export async function proxy(request: NextRequest) {
  // No password configured means no gate (local development, previews).
  if (!gatePassword()) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (PUBLIC.has(pathname)) return NextResponse.next()

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (await verifySessionToken(token)) return NextResponse.next()

  // The dashboard's fetch calls get JSON, not an HTML login page.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in to use this demo.' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  if (pathname !== '/') url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
