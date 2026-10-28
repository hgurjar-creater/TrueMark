import { db } from '../db'
import { geminiReview } from '@backend/review/gemini'
import { checkTerms } from './deterministic'
import { mockReview } from './mock'
import { verifyFindings, type ApprovedLibrary } from './verify'
import type { FindingDraft } from './types'

export interface ReviewCall {
  provider: 'gemini' | 'mock'
  model: string
  ok: boolean
  error?: string
}

export interface ReviewResult {
  drafts: FindingDraft[]
  calls: ReviewCall[]
}

const MOCK_MODEL = 'deterministic-rules-v1'

function dedupe(drafts: FindingDraft[]): FindingDraft[] {
  const seen = new Set<string>()
  return drafts.filter((draft) => {
    const key = `${draft.sourceType}:${draft.sourceId}:${draft.spanStart}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Gemini request failed.'
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  return (apiKey ? message.replaceAll(apiKey, '[redacted]') : message).slice(0, 240)
}

// Deterministic term checks always run. Gemini receives only the draft and a
// small set of retrieved approved sources; if the provider is unavailable,
// the offline mock keeps submission review working end to end.
export async function runReview(content: string, externalContent = content, workspaceId = 'truemark-demo'): Promise<ReviewResult> {
  const [rules, facts, terms] = await Promise.all([
    db.rule.findMany({ where: { approved: true, workspaceId } }),
    db.fact.findMany({ where: { approved: true, workspaceId } }),
    db.term.findMany({ where: { approved: true, workspaceId } }),
  ])

  const library: ApprovedLibrary = {
    rules: new Map(rules.map((rule) => [rule.id, rule])),
    facts: new Map(facts.map((fact) => [fact.id, fact])),
    terms: new Map(terms.map((term) => [term.id, term])),
  }

  const deterministicFindings = checkTerms(content, terms)
  const calls: ReviewCall[] = []
  let providerFindings: FindingDraft[]

  if (process.env.GEMINI_API_KEY?.trim()) {
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash'
    try {
      providerFindings = await geminiReview(externalContent, rules, facts, workspaceId)
      calls.push({ provider: 'gemini', model, ok: true })
    } catch (error) {
      calls.push({ provider: 'gemini', model, ok: false, error: safeError(error) })
      providerFindings = mockReview(content, rules, facts, workspaceId)
      calls.push({ provider: 'mock', model: MOCK_MODEL, ok: true })
    }
  } else {
    providerFindings = mockReview(content, rules, facts, workspaceId)
    calls.push({ provider: 'mock', model: MOCK_MODEL, ok: true })
  }

  return {
    drafts: verifyFindings(dedupe([...deterministicFindings, ...providerFindings]), content, library),
    calls,
  }
}
