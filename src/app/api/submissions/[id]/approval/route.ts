import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { approvalSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

export const POST = withAuth<Ctx>(['MANAGER', 'ADMIN'], async (req, session, { params }) => {
  const parsed = await parseJsonBody(req, approvalSchema)
  if (!parsed.ok) return parsed.response
  const { action, comment } = parsed.data

  const submission = await db.submission.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  })
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
  }
  if (submission.status === 'PUBLISHED') {
    return NextResponse.json({ error: 'This submission is already published.' }, { status: 409 })
  }

  const status = action === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED'
  await db.$transaction(async (tx) => {
    await tx.submission.update({ where: { id: submission.id }, data: { status } })
    if (comment) {
      await tx.comment.create({
        data: { submissionId: submission.id, authorId: session.id, body: comment },
      })
    }
  })

  await writeAudit(action === 'APPROVE' ? 'SUBMISSION_APPROVED' : 'CHANGES_REQUESTED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { action },
  })

  return NextResponse.json({ ok: true, status })
})
