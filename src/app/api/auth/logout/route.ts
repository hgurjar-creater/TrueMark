import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/session-token'
import { getSession } from '@/lib/session'
import { writeAudit } from '@/lib/api'

export async function POST() {
  const session = await getSession()
  if (session) {
    await writeAudit('USER_LOGOUT', 'User', { actorId: session.id, entityId: session.id })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}
