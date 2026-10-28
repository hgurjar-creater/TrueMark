import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session-token'

// Page-level guard. API routes enforce their own authorisation through
// withAuth() — this middleware only protects the page tree.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (req.nextUrl.pathname.startsWith('/admin') && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL(session.role === 'SUPER_ADMIN' ? '/superadmin' : '/dashboard', req.url))
  }

  if (req.nextUrl.pathname.startsWith('/superadmin') && session.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL(session.role === 'ADMIN' ? '/admin' : '/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/superadmin/:path*'],
}
