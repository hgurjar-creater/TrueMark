import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, writeAudit } from '@/lib/api'
import { createProvisionedUser, listProvisionedUsers } from '@backend/accounts/provision'
import { workspaceIdOrError } from '@/lib/workspace'

const workspaceRoleSchema = z.object({ role: z.enum(['MANAGER', 'CREATOR']) })

export const GET = withAuth(['ADMIN'], async (_req, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const users = await listProvisionedUsers(['MANAGER', 'CREATOR'], workspaceId)
  return NextResponse.json({ users })
})

export const POST = withAuth(['ADMIN'], async (req: NextRequest, session) => {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const roleResult = workspaceRoleSchema.safeParse(raw)
  if (!roleResult.success || !raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Choose a Manager or Creator role.' }, { status: 422 })
  }

  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const result = await createProvisionedUser(raw, roleResult.data.role, workspaceId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.issues ? { issues: result.issues } : {}) }, { status: result.status })
  }

  await writeAudit('WORKSPACE_ACCOUNT_CREATED', 'User', {
    actorId: session.id,
    entityId: result.data.id,
    metadata: { email: result.data.email, role: result.data.role },
  })
  return NextResponse.json({ user: result.data }, { status: result.status })
})
