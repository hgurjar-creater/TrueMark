import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { db } from '@/lib/db'
import { buildGuidelineInsights } from '@/lib/review/insights'
import { workspaceIdOrError } from '@/lib/workspace'

export const GET = withAuth(['ADMIN'], async (_req, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  return NextResponse.json({ insights: await buildGuidelineInsights(workspaceId) })
})

export const POST = withAuth(['ADMIN'], async (req: NextRequest, session) => {
  const parsed = await parseJsonBody(req, z.object({
    sourceKey: z.string().min(3).max(180),
    clarificationDraft: z.string().trim().min(20).max(4000),
    status: z.enum(['DRAFT', 'REVIEWED']),
  }))
  if (!parsed.ok) return parsed.response
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const candidate = (await buildGuidelineInsights(workspaceId)).find((insight) => insight.sourceKey === parsed.data.sourceKey)
  if (!candidate) return NextResponse.json({ error: 'This insight no longer meets the review threshold.' }, { status: 409 })

  const insight = await db.guidelineInsight.upsert({
    where: { sourceKey: candidate.sourceKey },
    create: {
      sourceKey: candidate.sourceKey, sourceType: candidate.sourceType, sourceId: candidate.sourceId,
      sourceCode: candidate.sourceCode, sourceTitle: candidate.sourceTitle, sourceText: candidate.sourceText,
      decisionCount: candidate.decisionCount, dismissalRate: candidate.dismissalRate,
      sampleNotes: JSON.stringify(candidate.sampleNotes),
      clarificationDraft: parsed.data.clarificationDraft, status: parsed.data.status,
    },
    update: {
      sourceTitle: candidate.sourceTitle, sourceText: candidate.sourceText,
      decisionCount: candidate.decisionCount, dismissalRate: candidate.dismissalRate,
      sampleNotes: JSON.stringify(candidate.sampleNotes),
      clarificationDraft: parsed.data.clarificationDraft, status: parsed.data.status,
    },
  })
  await writeAudit(parsed.data.status === 'REVIEWED' ? 'GUIDELINE_INSIGHT_REVIEWED' : 'GUIDELINE_INSIGHT_DRAFT_SAVED', 'GuidelineInsight', {
    actorId: session.id, entityId: insight.id,
    metadata: { sourceCode: candidate.sourceCode, dismissalRate: candidate.dismissalRate },
  })
  return NextResponse.json({ insight: { sourceKey: insight.sourceKey, status: insight.status } })
})
