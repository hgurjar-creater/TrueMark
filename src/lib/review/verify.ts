import type { Fact, Rule, Term } from '@prisma/client'
import type { FindingDraft } from './types'

export interface ApprovedLibrary {
  rules: Map<string, Rule>
  facts: Map<string, Fact>
  terms: Map<string, Term>
}

// The verifier is the product's core reliability promise: a finding is kept
// only when it cites a known, approved source and quotes a span that appears
// verbatim at the recorded position in the reviewed draft. Everything else is
// discarded before it is ever stored or shown to a reviewer.
export function verifyFindings(
  drafts: FindingDraft[],
  content: string,
  library: ApprovedLibrary,
): FindingDraft[] {
  return drafts.filter((draft) => {
    if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 1) return false
    if (draft.quotedSpan.length === 0) return false
    if (content.slice(draft.spanStart, draft.spanEnd) !== draft.quotedSpan) return false
    if (!draft.explanation.trim()) return false
    if (draft.spanEnd <= draft.spanStart) return false

    switch (draft.sourceType) {
      case 'RULE': {
        const rule = library.rules.get(draft.sourceId)
        return !!rule && rule.approved && rule.code === draft.sourceCode
      }
      case 'FACT': {
        const fact = library.facts.get(draft.sourceId)
        return !!fact && fact.approved && fact.code === draft.sourceCode
      }
      case 'TERM': {
        const term = library.terms.get(draft.sourceId)
        return !!term && term.approved && term.code === draft.sourceCode
      }
      default:
        return false
    }
  })
}
