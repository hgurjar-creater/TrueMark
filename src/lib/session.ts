// Server-side session reader for route handlers and server components.
// (Not usable in middleware — use src/lib/session-token.ts there.)

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionUser } from './session-token'

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}
