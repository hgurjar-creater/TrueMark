import { z } from 'zod'
import type { Role } from '@/lib/validation'
import { hashPassword } from '@/lib/auth'
import { db } from '@/lib/db'

const provisionUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
  password: z.string().min(12, 'Use a temporary password with at least 12 characters.').max(72),
})

export type ProvisionResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; issues?: Record<string, string[]> }

export async function listProvisionedUsers(roles: Role[], workspaceId: string) {
  return db.user.findMany({
    where: { role: { in: roles }, workspaceId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })
}

export async function createProvisionedUser(
  raw: unknown,
  role: Extract<Role, 'MANAGER' | 'CREATOR'>,
  workspaceId: string,
): Promise<ProvisionResult<{ id: string; name: string; email: string; role: string; createdAt: Date }>> {
  const parsed = provisionUserSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, status: 422, error: 'Invalid account details.', issues: parsed.error.flatten().fieldErrors }
  }

  try {
    const { password, ...userData } = parsed.data
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { ...userData, passwordHash, role, workspaceId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return { ok: true, status: 201, data: user }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return { ok: false, status: 409, error: 'An account with this email already exists.' }
    }
    console.error('[accounts] Unable to provision user:', error)
    return { ok: false, status: 500, error: 'Unable to create this account.' }
  }
}
