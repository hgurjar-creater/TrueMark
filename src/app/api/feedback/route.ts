import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { db } from '@/lib/db'

export const POST = withAuth(null, async (req: NextRequest, session) => {
  if (!session.workspaceId || session.role === 'SUPER_ADMIN') return NextResponse.json({ error: 'Feedback is available to users assigned to a brand.' }, { status: 403 })
  const parsed = await parseJsonBody(req, z.object({
    submissionId: z.string().min(1).optional(),
    helpfulness: z.number().int().min(1).max(5),
    category: z.enum(['TEXT_REVIEW', 'VISUAL_REVIEW', 'ACCESSIBILITY', 'WORKFLOW']),
    comment: z.string().trim().max(1000).optional(),
  }))
  if (!parsed.ok) return parsed.response
  if (parsed.data.submissionId) {
    const submission = await db.submission.findUnique({ where: { id: parsed.data.submissionId, workspaceId: session.workspaceId }, select: { id: true, creatorId: true } })
    if (!submission) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    if (submission.creatorId !== session.id && !['ADMIN', 'MANAGER'].includes(session.role)) {
      return NextResponse.json({ error: 'You cannot provide feedback on this submission.' }, { status: 403 })
    }
  }
  const feedback = await db.productFeedback.create({
    data: {
      userId: session.id,
      workspaceId: session.workspaceId,
      submissionId: parsed.data.submissionId ?? null,
      helpfulness: parsed.data.helpfulness,
      category: parsed.data.category,
      comment: parsed.data.comment || null,
    },
  })
  await writeAudit('PRODUCT_FEEDBACK_SUBMITTED', 'ProductFeedback', {
    actorId: session.id, entityId: feedback.id,
    metadata: { category: feedback.category, helpfulness: feedback.helpfulness, submissionId: feedback.submissionId },
  })
  return NextResponse.json({ id: feedback.id }, { status: 201 })
})
