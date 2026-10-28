import { db } from '@/lib/db'

export interface GuidelineInsightView {
  sourceKey: string
  sourceType: string
  sourceId: string
  sourceCode: string
  sourceTitle: string
  sourceText: string
  decisionCount: number
  dismissalRate: number
  sampleNotes: string[]
  clarificationDraft: string
  status: string
}

export async function buildGuidelineInsights(workspaceId: string): Promise<GuidelineInsightView[]> {
  const decisions = await db.finding.findMany({
    where: { status: { in: ['ACCEPTED', 'EDITED', 'DISMISSED'] }, submission: { is: { workspaceId } } },
    include: { rule: true, fact: true, term: true },
    orderBy: { createdAt: 'desc' },
  })
  const groups = new Map<string, {
    sourceType: string; sourceId: string; sourceCode: string; sourceTitle: string; sourceText: string;
    decisionCount: number; dismissals: number; notes: string[]
  }>()
  for (const finding of decisions) {
    const sourceId = finding.ruleId ?? finding.factId ?? finding.termId
    if (!sourceId) continue
    const key = `${workspaceId}:${finding.sourceType}:${sourceId}`
    const sourceTitle = finding.rule?.title ?? (finding.fact ? `Fact ${finding.fact.code}` : finding.term ? `Term “${finding.term.value}”` : finding.sourceCode)
    const sourceText = finding.rule?.text ?? finding.fact?.statement ?? (finding.term ? `${finding.term.status} “${finding.term.value}”; ${finding.term.reason}` : '')
    const group = groups.get(key) ?? {
      sourceType: finding.sourceType, sourceId, sourceCode: finding.sourceCode, sourceTitle, sourceText,
      decisionCount: 0, dismissals: 0, notes: [],
    }
    group.decisionCount += 1
    if (finding.status === 'DISMISSED') {
      group.dismissals += 1
      if (finding.decisionNote && !group.notes.includes(finding.decisionNote) && group.notes.length < 4) group.notes.push(finding.decisionNote)
    }
    groups.set(key, group)
  }

  const candidates = [...groups.entries()]
    .filter(([, group]) => group.decisionCount >= 5 && group.dismissals / group.decisionCount >= 0.4)
  if (!candidates.length) return []
  const stored = await db.guidelineInsight.findMany({ where: { sourceKey: { in: candidates.map(([key]) => key) } } })
  const byKey = new Map(stored.map((item) => [item.sourceKey, item]))
  return candidates.map(([sourceKey, group]) => {
    const existing = byKey.get(sourceKey)
    const dismissalRate = Math.round((group.dismissals / group.decisionCount) * 100)
    const noteContext = group.notes.length
      ? `Recent dismissal reasons include: ${group.notes.map((note) => `“${note}”`).join('; ')}.`
      : 'Reviewers have not provided a written dismissal reason for these cases.'
    const suggestedDraft = `Clarification to review: ${group.sourceText}\n\nThis guidance was dismissed in ${group.dismissals} of ${group.decisionCount} recorded decisions (${dismissalRate}%). ${noteContext}\n\nPlease specify the intended scope, examples, and any exceptions before updating the approved guidance.`
    return {
      sourceKey, sourceType: group.sourceType, sourceId: group.sourceId, sourceCode: group.sourceCode,
      sourceTitle: group.sourceTitle, sourceText: group.sourceText,
      decisionCount: group.decisionCount, dismissalRate, sampleNotes: group.notes,
      clarificationDraft: existing?.clarificationDraft ?? suggestedDraft,
      status: existing?.status ?? 'DRAFT',
    }
  })
}
