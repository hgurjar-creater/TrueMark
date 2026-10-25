import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { submissionSchema } from '@/lib/validation'
import { runReview, REVIEW_MODEL, REVIEW_PROVIDER } from '@/lib/review/run-review'
import type { FindingDraft } from '@/lib/review/types'

function toFindingRows(submissionId: string, drafts: FindingDraft[]) {
  return drafts.map((draft) => ({
    submissionId,
    reviewedVersion: 1,
    sourceType: draft.sourceType,
    ruleId: draft.sourceType === 'RULE' ? draft.sourceId : null,
    factId: draft.sourceType === 'FACT' ? draft.sourceId : null,
    termId: draft.sourceType === 'TERM' ? draft.sourceId : null,
    sourceCode: draft.sourceCode,
    quotedSpan: draft.quotedSpan,
    spanStart: draft.spanStart,
    spanEnd: draft.spanEnd,
    explanation: draft.explanation,
    suggestedFix: draft.suggestedFix ?? null,
    severity: draft.severity,
    confidence: draft.confidence,
    origin: draft.origin,
  }))
}

export const POST = withAuth(null, async (req: NextRequest, session) => {
  const parsed = await parseJsonBody(req, submissionSchema)
  if (!parsed.ok) return parsed.response
  const { title, channel, purpose, content } = parsed.data

  // Review runs before anything is stored: if the pipeline fails, no half
  // submission is left behind.
  const drafts = await runReview(content)

  const submission = await db.$transaction(async (tx) => {
    const created = await tx.submission.create({
      data: { title, channel, purpose, content, status: 'IN_REVIEW', creatorId: session.id },
    })
    await tx.version.create({
      data: {
        submissionId: created.id,
        versionNumber: 1,
        content,
        createdById: session.id,
        note: 'Original submission.',
      },
    })
    for (const row of toFindingRows(created.id, drafts)) {
      await tx.finding.create({ data: row })
    }
    await tx.aiCallLog.create({
      data: { submissionId: created.id, provider: REVIEW_PROVIDER, model: REVIEW_MODEL, ok: true },
    })
    return created
  })

  await writeAudit('SUBMISSION_CREATED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { title, channel },
  })
  await writeAudit('REVIEW_COMPLETED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { provider: REVIEW_PROVIDER, findings: drafts.length },
  })

  return NextResponse.json({ id: submission.id, findings: drafts.length }, { status: 201 })
})
