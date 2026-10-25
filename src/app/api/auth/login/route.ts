import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
  type SessionUser,
} from '@/lib/session-token'
import { parseJsonBody, writeAudit } from '@/lib/api'
import { loginSchema, toRole } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, loginSchema)
  if (!parsed.ok) return parsed.response
  const { email, password } = parsed.data

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await writeAudit('USER_LOGIN_FAILED', 'User', { metadata: { email } })
    // Same message for unknown email and wrong password — never reveal which.
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 })
  }

  const role = toRole(user.role)
  if (!role) throw new Error(`User ${user.id} has an unknown role "${user.role}".`)
  const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email, role }

  const token = await createSessionToken(sessionUser)
  await writeAudit('USER_LOGIN', 'User', { actorId: user.id, entityId: user.id })

  const res = NextResponse.json({ user: sessionUser })
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV === 'production'))
  return res
}
