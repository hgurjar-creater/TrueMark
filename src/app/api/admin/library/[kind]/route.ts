import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, writeAudit } from '@/lib/api'
import { createLibraryItem, libraryEntityName, listLibraryItems } from '@backend/library/service'
import { isLibraryKind } from '@backend/library/schemas'
import { workspaceIdOrError } from '@/lib/workspace'

type RouteContext = { params: { kind: string } }

export const GET = withAuth<RouteContext>(['ADMIN'], async (_req, session, { params }) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const result = await listLibraryItems(params.kind, workspaceId)
  return result.ok
    ? NextResponse.json({ items: result.data }, { status: result.status })
    : NextResponse.json({ error: result.error }, { status: result.status })
})

export const POST = withAuth<RouteContext>(['ADMIN'], async (req: NextRequest, session, { params }) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const result = await createLibraryItem(params.kind, raw, workspaceId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.issues ? { issues: result.issues } : {}) }, { status: result.status })
  }

  const entityType = isLibraryKind(params.kind) ? libraryEntityName(params.kind) : 'LibraryItem'
  const item = result.data as { id: string; code: string }
  await writeAudit('LIBRARY_ITEM_CREATED', entityType, {
    actorId: session.id,
    entityId: item.id,
    metadata: { code: item.code },
  })
  return NextResponse.json({ item }, { status: result.status })
})
