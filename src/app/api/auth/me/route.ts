import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { toRole } from '@/lib/validation'

// Returns the fresh user record (not the JWT snapshot) so role changes made
// after login are reflected on the next check.
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.id } })
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const role = toRole(user.role)
  if (!role) {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role } })
}
