import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { commentSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export const POST = withAuth<Ctx>(null, async (req: NextRequest, session, { params }) => {
  const parsed = await parseJsonBody(req, commentSchema)
  if (!parsed.ok) return parsed.response

  const submission = await db.submission.findUnique({
    where: { id: params.id },
    select: { id: true, creatorId: true },
  })
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
  }

  const canComment =
    session.id === submission.creatorId || session.role === 'MANAGER' || session.role === 'ADMIN'
  if (!canComment) {
    return NextResponse.json({ error: 'You do not have access to this submission.' }, { status: 403 })
  }

  const comment = await db.comment.create({
    data: { submissionId: submission.id, authorId: session.id, body: parsed.data.body },
  })
  await writeAudit('COMMENT_ADDED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { commentId: comment.id },
  })

  return NextResponse.json({ id: comment.id }, { status: 201 })
})
