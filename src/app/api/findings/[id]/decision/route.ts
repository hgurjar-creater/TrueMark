import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { decisionSchema } from '@/lib/validation'

type Ctx = { params: { id: string } }

function truncate(value: string): string {
  return value.length > 40 ? `${value.slice(0, 37)}...` : value
}

export const POST = withAuth<Ctx>(null, async (req: NextRequest, session, { params }) => {
  const parsed = await parseJsonBody(req, decisionSchema)
  if (!parsed.ok) return parsed.response
  const { action, replacement: editedReplacement, note } = parsed.data

  const finding = await db.finding.findUnique({
    where: { id: params.id },
    include: {
      submission: {
        include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      },
    },
  })
  if (!finding) {
    return NextResponse.json({ error: 'Finding not found.' }, { status: 404 })
  }
  if (finding.submission.creatorId !== session.id) {
    return NextResponse.json(
      { error: 'Only the creator of this submission can respond to its findings.' },
      { status: 403 },
    )
  }
  if (finding.status !== 'OPEN') {
    return NextResponse.json({ error: 'This finding has already been decided.' }, { status: 409 })
  }

  if (action === 'DISMISS') {
    await db.finding.update({
      where: { id: finding.id },
      data: { status: 'DISMISSED', decidedById: session.id, decisionNote: note ?? null },
    })
    await writeAudit('FINDING_DISMISSED', 'Finding', {
      actorId: session.id,
      entityId: finding.id,
      metadata: { sourceCode: finding.sourceCode, submissionId: finding.submissionId },
    })
    return NextResponse.json({ ok: true, status: 'DISMISSED' })
  }

  // ACCEPT applies the approved replacement carried by the finding; EDIT
  // applies the text the creator typed instead.
  const replacement = action === 'ACCEPT' ? (finding.suggestedFix ?? undefined) : editedReplacement
  if (!replacement) {
    return NextResponse.json(
      { error: 'This finding carries no suggested replacement to accept. Edit the text instead.' },
      { status: 400 },
    )
  }

  const latest = finding.submission.versions[0]
  if (!latest) {
    return NextResponse.json({ error: 'Submission has no versions.' }, { status: 500 })
  }

  const content = latest.content
  const storedPositionValid =
    finding.spanStart !== null &&
    finding.spanEnd !== null &&
    finding.reviewedVersion === latest.versionNumber &&
    content.slice(finding.spanStart, finding.spanEnd) === finding.quotedSpan

  let start: number
  let end: number
  if (storedPositionValid && finding.spanStart !== null && finding.spanEnd !== null) {
    start = finding.spanStart
    end = finding.spanEnd
  } else {
    const index = content.indexOf(finding.quotedSpan)
    if (index === -1) {
      return NextResponse.json(
        { error: 'The quoted text is no longer present in the latest version. Edit the draft text directly instead.' },
        { status: 409 },
      )
    }
    start = index
    end = index + finding.quotedSpan.length
  }

  const newContent = content.slice(0, start) + replacement + content.slice(end)
  const versionNumber = latest.versionNumber + 1
  const versionNote =
    note ??
    (action === 'ACCEPT'
      ? `Accepted ${finding.sourceCode}: replaced "${truncate(finding.quotedSpan)}" with "${truncate(replacement)}".`
      : `Edited fix for ${finding.sourceCode}: replaced "${truncate(finding.quotedSpan)}" with "${truncate(replacement)}".`)

  await db.$transaction(async (tx) => {
    await tx.version.create({
      data: {
        submissionId: finding.submissionId,
        versionNumber,
        content: newContent,
        createdById: session.id,
        note: versionNote,
      },
    })
    await tx.finding.update({
      where: { id: finding.id },
      data: {
        status: action === 'ACCEPT' ? 'ACCEPTED' : 'EDITED',
        decidedById: session.id,
        decisionNote: note ?? null,
      },
    })
    if (finding.submission.status === 'CHANGES_REQUESTED') {
      await tx.submission.update({ where: { id: finding.submissionId }, data: { status: 'IN_REVIEW' } })
    }
  })

  await writeAudit(action === 'ACCEPT' ? 'FINDING_ACCEPTED' : 'FINDING_EDITED', 'Finding', {
    actorId: session.id,
    entityId: finding.id,
    metadata: { sourceCode: finding.sourceCode, submissionId: finding.submissionId, versionNumber },
  })
  await writeAudit('SUBMISSION_VERSION_CREATED', 'Submission', {
    actorId: session.id,
    entityId: finding.submissionId,
    metadata: { versionNumber },
  })

  return NextResponse.json({ ok: true, status: action === 'ACCEPT' ? 'ACCEPTED' : 'EDITED', versionNumber })
})
