import { NextResponse, type NextRequest } from 'next/server'
import { withAuth } from '@/lib/api'
import { db } from '@/lib/db'
import { readPrivateAsset } from '@/lib/files/private-assets'
import type { SessionUser } from '@/lib/session-token'

type Ctx = { params: { id: string } }

export const GET = withAuth<Ctx>(['ADMIN', 'MANAGER', 'CREATOR'], async (_req: NextRequest, session: SessionUser, { params }) => {
  if (!session.workspaceId) return NextResponse.json({ error: 'No brand workspace is assigned.' }, { status: 403 })
  const submission = await db.submission.findFirst({
    where: { id: params.id, workspaceId: session.workspaceId, ...(session.role === 'CREATOR' ? { creatorId: session.id } : {}) },
    select: { imageStorageKey: true, imageData: true, imageMimeType: true },
  })
  if (!submission?.imageMimeType || (!submission.imageStorageKey && !submission.imageData)) {
    return NextResponse.json({ error: 'Creative image not found.' }, { status: 404 })
  }

  const bytes = submission.imageStorageKey
    ? await readPrivateAsset(submission.imageStorageKey)
    : Buffer.from(submission.imageData!, 'base64')
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': submission.imageMimeType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
