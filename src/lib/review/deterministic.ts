import type { Term } from '@prisma/client'
import type { FindingDraft } from './types'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Banned terms are matched on word boundaries so "cheap" does not match
// "cheaper". Every match becomes a finding with confidence 1.0 — deterministic
// checks are exact by construction and carry the term's approved replacement.
export function checkTerms(content: string, terms: Term[]): FindingDraft[] {
  const drafts: FindingDraft[] = []
  for (const term of terms) {
    if (term.status !== 'BANNED') continue
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(term.value)}(?![\\p{L}\\p{N}])`,
      'gi',
    )
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      if (match[0].length === 0) break
      drafts.push({
        sourceType: 'TERM',
        sourceId: term.id,
        sourceCode: term.code,
        quotedSpan: match[0],
        spanStart: match.index,
        spanEnd: match.index + match[0].length,
        explanation: `"${match[0]}" is a banned term (${term.code}). ${term.replacement ? `Preferred alternative: "${term.replacement}". ` : ''}${term.reason}`,
        suggestedFix: term.replacement ?? undefined,
        severity: 'MEDIUM',
        confidence: 1,
        origin: 'DETERMINISTIC',
      })
    }
  }
  return drafts
}
