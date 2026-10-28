import { db } from '@/lib/db'
import { getBrandProfile } from '@/lib/brand-profile'
import { maskConfidentialRanges } from '@/lib/review/privacy'
import { runReview } from '@/lib/review/run-review'
import type { FindingDraft } from '@/lib/review/types'
import { reviewBrandImage } from '@backend/review/visual'
import { readPrivateAsset } from '@/lib/files/private-assets'

const MAX_ATTEMPTS = 3

function findingKey(finding: Pick<FindingDraft, 'sourceType' | 'sourceId' | 'spanStart' | 'spanEnd'>) {
  return `${finding.sourceType}:${finding.sourceId}:${finding.spanStart}:${finding.spanEnd}`
}

function findingRow(submissionId: string, draft: FindingDraft) {
  return {
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
  }
}

export async function recoverStaleReviewJobs() {
  const staleBefore = new Date(Date.now() - 2 * 60_000)
  await db.reviewJob.updateMany({
    where: { status: 'RUNNING', updatedAt: { lt: staleBefore } },
    data: { status: 'QUEUED', availableAt: new Date(), error: 'Recovered after a worker restart.' },
  })
}

export async function claimNextReviewJob(submissionId?: string): Promise<string | null> {
  const now = new Date()
  const candidates = await db.reviewJob.findMany({
    where: { status: 'QUEUED', availableAt: { lte: now }, ...(submissionId ? { submissionId } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: { id: true },
  })

  for (const candidate of candidates) {
    const claimed = await db.reviewJob.updateMany({
      where: { id: candidate.id, status: 'QUEUED', availableAt: { lte: now } },
      data: { status: 'RUNNING', attempts: { increment: 1 }, startedAt: now, error: null },
    })
    if (claimed.count === 1) return candidate.id
  }
  return null
}

// Vercel serverless requests dispatch one queued review instead of relying on
// a permanently running worker process. Atomic claiming keeps concurrent
// status polls from processing the same submission twice.
export async function processQueuedReviewJob(submissionId: string) {
  try {
    const staleBefore = new Date(Date.now() - 2 * 60_000)
    await db.reviewJob.updateMany({
      where: { submissionId, status: 'RUNNING', updatedAt: { lt: staleBefore } },
      data: { status: 'QUEUED', availableAt: new Date(), error: 'Recovered after a timed-out review.' },
    })
    const jobId = await claimNextReviewJob(submissionId)
    if (jobId) await processReviewJob(jobId)
  } catch (error) {
    console.error('[review-worker] Could not dispatch queued review:', error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function processReviewJob(jobId: string) {
  const job = await db.reviewJob.findUnique({
    where: { id: jobId },
    include: { submission: true },
  })
  if (!job || job.status !== 'RUNNING') return

  const submission = job.submission
  const workspaceId = submission.workspaceId
  if (!workspaceId) throw new Error('The submission is not assigned to a brand workspace.')

  try {
    await db.submission.update({ where: { id: submission.id }, data: { reviewStatus: 'PROCESSING' } })
    let confidentialSpans: { start: number; end: number }[] = []
    if (submission.confidentialSpans) {
      try {
        const value: unknown = JSON.parse(submission.confidentialSpans)
        if (Array.isArray(value)) confidentialSpans = value
      } catch {
        confidentialSpans = []
      }
    }
    const privacy = maskConfidentialRanges(submission.content, confidentialSpans)
    const profile = submission.imageStorageKey || submission.imageData
      ? await getBrandProfile(workspaceId)
      : null
    const imageBuffer = submission.imageStorageKey
      ? await readPrivateAsset(submission.imageStorageKey)
      : submission.imageData
        ? Buffer.from(submission.imageData, 'base64')
        : null

    const [review, visualReview] = await Promise.all([
      runReview(submission.content, privacy.text, workspaceId),
      imageBuffer && submission.imageMimeType && profile
        ? reviewBrandImage({
            buffer: imageBuffer,
            mimeType: submission.imageMimeType,
            altText: submission.imageAltText ?? '',
            profile: {
              name: profile.name,
              palette: profile.palette,
              logoData: profile.logoData,
              logoMimeType: profile.logoMimeType,
            },
          })
        : Promise.resolve(null),
    ])

    const existing = await db.finding.findMany({
      where: { submissionId: submission.id, reviewedVersion: 1 },
      select: { sourceType: true, ruleId: true, factId: true, termId: true, spanStart: true, spanEnd: true },
    })
    const existingKeys = new Set(existing.map((row) => {
      const sourceId = row.ruleId ?? row.factId ?? row.termId ?? ''
      return findingKey({ sourceType: row.sourceType as FindingDraft['sourceType'], sourceId, spanStart: row.spanStart ?? 0, spanEnd: row.spanEnd ?? 0 })
    }))
    const newFindings = review.drafts.filter((draft) => !existingKeys.has(findingKey(draft)))

    await db.$transaction(async (tx) => {
      for (const draft of newFindings) await tx.finding.create({ data: findingRow(submission.id, draft) })
      await tx.submission.update({
        where: { id: submission.id },
        data: { reviewStatus: 'COMPLETED', ...(visualReview ? { visualReview: JSON.stringify(visualReview) } : {}) },
      })
      if (visualReview) {
        await tx.aiCallLog.create({
          data: {
            submissionId: submission.id,
            provider: visualReview.provider,
            model: visualReview.model,
            ok: visualReview.provider === 'gemini',
            error: visualReview.providerError ?? null,
          },
        })
      }
      for (const call of review.calls) {
        await tx.aiCallLog.create({
          data: {
            submissionId: submission.id,
            provider: call.provider,
            model: call.model,
            ok: call.ok,
            error: call.error ?? null,
          },
        })
      }
      await tx.reviewJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date(), error: null } })
      await tx.auditLog.create({
        data: {
          actorId: submission.creatorId,
          action: 'REVIEW_COMPLETED',
          entityType: 'Submission',
          entityId: submission.id,
          metadata: JSON.stringify({ providers: review.calls.map(({ provider, ok }) => ({ provider, ok })), findings: review.drafts.length }),
        },
      })
    })
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'Review worker failed.').slice(0, 300)
    const terminal = job.attempts >= MAX_ATTEMPTS
    await db.$transaction([
      db.reviewJob.update({
        where: { id: jobId },
        data: {
          status: terminal ? 'FAILED' : 'QUEUED',
          availableAt: new Date(Date.now() + job.attempts * 5000),
          error: message,
        },
      }),
      db.submission.update({
        where: { id: submission.id },
        data: { reviewStatus: terminal ? 'FAILED' : 'PENDING' },
      }),
    ])
  }
}
