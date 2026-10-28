import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
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

// The first account on a truly empty database becomes the platform Super Admin.
// Brand Admins are provisioned by the Super Admin after creating a workspace.
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, registerSchema)
  if (!parsed.ok) return parsed.response
  const { name, email, password, setupSecret } = parsed.data

  const configuredSecret = process.env.SUPER_ADMIN_SETUP_SECRET
  const provided = Buffer.from(setupSecret)
  const configured = Buffer.from(configuredSecret ?? '')
  if (!configuredSecret || provided.length !== configured.length || !timingSafeEqual(provided, configured)) {
    return NextResponse.json({ error: 'Super Admin setup is restricted. Contact TrueMark for the one-time setup code.' }, { status: 403 })
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const userCount = await db.user.count()
  if (userCount > 0) {
    return NextResponse.json(
      { error: 'Registration is closed. Contact TrueMark for Super Admin access; brand accounts are provisioned by a Super Admin.' },
      { status: 403 },
    )
  }

  const passwordHash = await hashPassword(password)
  const user = await db.user.create({ data: { name, email, passwordHash, role: 'SUPER_ADMIN' } })

  const role = toRole(user.role)
  if (!role) throw new Error(`User ${user.id} has an unknown role "${user.role}".`)
  const sessionUser: SessionUser = { id: user.id, name: user.name, email: user.email, role, workspaceId: user.workspaceId }

  const token = await createSessionToken(sessionUser)
  await writeAudit('SUPER_ADMIN_REGISTERED', 'User', {
    actorId: user.id,
    entityId: user.id,
    metadata: { email, bootstrap: true },
  })

  const res = NextResponse.json({ user: sessionUser }, { status: 201 })
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(process.env.NODE_ENV === 'production'))
  return res
}
