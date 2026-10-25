import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  sessionCookieOptions,
  type SessionUser,
} from '@/lib/session-token'
import { parseJsonBody, writeAudit } from '@/lib/api'
import { registerSchema, toRole } from '@/lib/validation'

// Registration always creates a CREATOR account. ADMIN and MANAGER accounts
// are provisioned by an administrator (see prisma/seed.js for the demo set).
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, registerSchema)
  if (!parsed.ok) return parsed.response
  const { name, email, password } = parsed.data

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({ data: { name, email, passwordHash } })

  const role = toRole(user.role)
  if (!role) throw new Error(`User ${user.id} has an unknown role "${user.role}".`)
  const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email, role }

  const token = await createSessionToken(sessionUser)
  await writeAudit('USER_REGISTERED', 'User', { actorId: user.id, entityId: user.id, metadata: { email } })

  const res = NextResponse.json({ user: sessionUser }, { status: 201 })
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV === 'production'))
  return res
}
