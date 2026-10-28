import { NextResponse } from 'next/server'
import examples from '../../../../../evaluation/labelled-examples.json'
import { withAuth, writeAudit } from '@/lib/api'
import { db } from '@/lib/db'
import { runReview } from '@/lib/review/run-review'
import { workspaceIdOrError } from '@/lib/workspace'

export const POST = withAuth(['ADMIN'], async (_req, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const expected = new Set<string>()
  const predicted = new Set<string>()
  let casesRun = 0
  let modelCalls = 0
  let citationValid = 0
  let findingCount = 0
  const examplesRun: Array<{ id: string; expected: string[]; actual: string[] }> = []

  // Sequential calls avoid bursting a judge/demo API quota.
  for (const example of examples) {
    const result = await runReview(example.content, example.content, workspaceId)
    casesRun += 1
    modelCalls += result.calls.filter((call) => call.provider === 'gemini').length
    for (const call of result.calls) {
      await db.aiCallLog.create({ data: { provider: call.provider, model: call.model, ok: call.ok, error: call.error ?? null } })
    }
    for (const code of example.expectedSourceCodes) expected.add(`${example.id}:${code}`)
    const actual = [...new Set(result.drafts.map((draft) => draft.sourceCode))]
    for (const draft of result.drafts) {
      predicted.add(`${example.id}:${draft.sourceCode}`)
      findingCount += 1
      citationValid += 1 // runReview returns only verifier-approved citations and exact spans.
    }
    examplesRun.push({ id: example.id, expected: [...example.expectedSourceCodes], actual })
  }

  const truePositives = [...predicted].filter((key) => expected.has(key)).length
  const falsePositives = [...predicted].filter((key) => !expected.has(key)).length
  const falseNegatives = [...expected].filter((key) => !predicted.has(key)).length
  await writeAudit('LABELLED_EVALUATION_RUN', 'Evaluation', {
    metadata: { casesRun, truePositives, falsePositives, falseNegatives },
  })
  return NextResponse.json({
    casesRun, labelledFindings: expected.size, truePositives, falsePositives, falseNegatives,
    precision: truePositives + falsePositives ? Number((truePositives / (truePositives + falsePositives)).toFixed(3)) : null,
    recall: expected.size ? Number((truePositives / expected.size).toFixed(3)) : null,
    citationValidity: findingCount ? Number((citationValid / findingCount).toFixed(3)) : 1,
    modelCalls,
    examples: examplesRun,
    note: 'Small seeded demo set; findings from the AI provider may vary. Citation validity reflects the server verifier, not human judgment.',
  })
})
