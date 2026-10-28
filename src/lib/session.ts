// Server-side session reader for route handlers and server components.
// (Not usable in middleware — use src/lib/session-token.ts there.)

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionUser } from './session-token'
import { db } from './db'
import { toRole } from './validation'

export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const tokenUser = await verifySessionToken(token)
  if (!tokenUser) return null

  // Tokens can outlive workspace/role changes. Use the account record as the
  // current source of truth so older pre-workspace cookies don't cause a
  // redirect loop or retain stale access.
  const user = await db.user.findUnique({
    where: { id: tokenUser.id },
    select: { id: true, name: true, email: true, role: true, workspaceId: true },
  })
  const role = user ? toRole(user.role) : null
  if (!user || !role) return null
  return { id: user.id, name: user.name, email: user.email, role, workspaceId: user.workspaceId }
}
