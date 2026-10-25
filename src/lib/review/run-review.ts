import { db } from '../db'
import { checkTerms } from './deterministic'
import { mockReview } from './mock'
import { verifyFindings, type ApprovedLibrary } from './verify'
import type { FindingDraft } from './types'

// Values recorded in AiCallLog for disclosure. The Gemini provider (Phase 3)
// replaces these behind the same contract — callers never change.
export const REVIEW_PROVIDER = 'mock'
export const REVIEW_MODEL = 'deterministic-rules-v1'

function dedupe(drafts: FindingDraft[]): FindingDraft[] {
  const seen = new Set<string>()
  return drafts.filter((draft) => {
    const key = `${draft.sourceType}:${draft.sourceId}:${draft.spanStart}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Round 2 review path: deterministic term checks plus the offline mock
// provider over the approved library. Every result is verified — a finding
// that cannot cite a known approved source with a verbatim span is dropped
// here and never reaches storage or the interface.
export async function runReview(content: string): Promise<FindingDraft[]> {
  const [rules, facts, terms] = await Promise.all([
    db.rule.findMany({ where: { approved: true } }),
    db.fact.findMany({ where: { approved: true } }),
    db.term.findMany({ where: { approved: true } }),
  ])

  const library: ApprovedLibrary = {
    rules: new Map(rules.map((rule) => [rule.id, rule])),
    facts: new Map(facts.map((fact) => [fact.id, fact])),
    terms: new Map(terms.map((term) => [term.id, term])),
  }

  const drafts = dedupe([...checkTerms(content, terms), ...mockReview(content, rules, facts)])
  return verifyFindings(drafts, content, library)
}
