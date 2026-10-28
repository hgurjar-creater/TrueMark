import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, writeAudit } from '@/lib/api'
import { deleteLibraryItem, libraryEntityName, updateLibraryItem } from '@backend/library/service'
import { isLibraryKind } from '@backend/library/schemas'
import { workspaceIdOrError } from '@/lib/workspace'

type RouteContext = { params: { kind: string; id: string } }

export const PATCH = withAuth<RouteContext>(['ADMIN'], async (req: NextRequest, session, { params }) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const result = await updateLibraryItem(params.kind, params.id, raw, workspaceId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, ...(result.issues ? { issues: result.issues } : {}) }, { status: result.status })
  }

  const entityType = isLibraryKind(params.kind) ? libraryEntityName(params.kind) : 'LibraryItem'
  const item = result.data as { id: string; code: string }
  await writeAudit('LIBRARY_ITEM_UPDATED', entityType, {
    actorId: session.id,
    entityId: item.id,
    metadata: { code: item.code },
  })
  return NextResponse.json({ item }, { status: result.status })
})

export const DELETE = withAuth<RouteContext>(['ADMIN'], async (_req, session, { params }) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const result = await deleteLibraryItem(params.kind, params.id, workspaceId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const entityType = isLibraryKind(params.kind) ? libraryEntityName(params.kind) : 'LibraryItem'
  await writeAudit('LIBRARY_ITEM_DELETED', entityType, {
    actorId: session.id,
    entityId: result.data.id,
    metadata: { kind: params.kind },
  })
  return NextResponse.json({ deleted: true, id: result.data.id }, { status: result.status })
})
