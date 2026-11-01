import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { workspaceIdOrError } from '@/lib/workspace'

const editSchema = z.object({
  content: z.string().trim().min(20, 'The draft must be at least 20 characters.').max(20000),
  note: z.string().trim().max(500).optional(),
})

type Ctx = { params: { id: string } }

// Direct draft editing: the submission's Creator (or a Manager/Admin) can
// revise the draft text without going through a finding decision. Each edit
// is saved as a new version so the word-level comparison history stays intact.
// Note: the review report reflects the originally reviewed version; direct
// edits are recorded as versions but do not automatically re-run AI review.
export const PATCH = withAuth<Ctx>(null, async (req: NextRequest, session, { params }) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId

  const parsed = await parseJsonBody(req, editSchema)
  if (!parsed.ok) return parsed.response
  const { content, note } = parsed.data

  const submission = await db.submission.findFirst({
    where: { id: params.id, workspaceId },
    include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
  })
  if (!submission) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })

  const isOwner = submission.creatorId === session.id
  const canEdit = isOwner || session.role === 'MANAGER' || session.role === 'ADMIN'
  if (!canEdit) {
    return NextResponse.json({ error: 'Only the submission creator or a Manager can edit the draft.' }, { status: 403 })
  }
  if (submission.status === 'PUBLISHED') {
    return NextResponse.json({ error: 'Published content can no longer be edited.' }, { status: 409 })
  }

  const latest = submission.versions[0]
  if (!latest) return NextResponse.json({ error: 'Submission has no versions.' }, { status: 500 })
  if (latest.content === content) {
    return NextResponse.json({ error: 'The draft text is unchanged.' }, { status: 422 })
  }

  const versionNumber = latest.versionNumber + 1
  const versionNote =
    note ?? `Draft edited directly by ${session.role.toLowerCase()} ${session.name}.`

  await db.$transaction(async (tx) => {
    await tx.version.create({
      data: {
        submissionId: submission.id,
        versionNumber,
        content,
        createdById: session.id,
        note: versionNote,
      },
    })
    if (submission.status === 'CHANGES_REQUESTED') {
      await tx.submission.update({ where: { id: submission.id }, data: { status: 'IN_REVIEW' } })
    }
  })

  await writeAudit('SUBMISSION_DRAFT_EDITED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { versionNumber, role: session.role },
  })

  return NextResponse.json({ ok: true, versionNumber })
})
