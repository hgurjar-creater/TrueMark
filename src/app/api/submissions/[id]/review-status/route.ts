import { NextResponse, type NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { withAuth } from '@/lib/api'
import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/session-token'
import { processQueuedReviewJob } from '@/lib/review/job-queue'

type Ctx = { params: { id: string } }

export const maxDuration = 60

export const GET = withAuth<Ctx>(['ADMIN', 'MANAGER', 'CREATOR'], async (_req: NextRequest, session: SessionUser, { params }) => {
  if (!session.workspaceId) return NextResponse.json({ error: 'No brand workspace is assigned.' }, { status: 403 })
  const submission = await db.submission.findFirst({
    where: { id: params.id, workspaceId: session.workspaceId, ...(session.role === 'CREATOR' ? { creatorId: session.id } : {}) },
    select: { reviewStatus: true, _count: { select: { findings: true } }, reviewJob: { select: { error: true } } },
  })
  if (!submission) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
  if (submission.reviewStatus === 'PENDING' || submission.reviewStatus === 'PROCESSING') {
    waitUntil(processQueuedReviewJob(params.id))
  }
  return NextResponse.json({ status: submission.reviewStatus, findings: submission._count.findings, error: submission.reviewJob?.error ?? null })
})
