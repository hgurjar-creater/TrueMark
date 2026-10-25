import type { FindingOrigin, Severity, SourceType } from '../validation'

// A finding produced by a review provider, before verification. Producers must
// already fill the exact character offsets of the quoted span inside the
// reviewed draft, so the verifier can check the quote is verbatim.
export interface FindingDraft {
  sourceType: SourceType
  sourceId: string
  sourceCode: string
  quotedSpan: string
  spanStart: number
  spanEnd: number
  explanation: string
  suggestedFix?: string
  severity: Severity
  confidence: number
  origin: FindingOrigin
}
