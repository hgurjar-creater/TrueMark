import type { Fact, Rule } from '@prisma/client'
import { tokenize } from './retrieval'
import { getWorkspaceIndexes } from '@backend/review/index-cache'
import type { FindingDraft } from './types'

interface Segment {
  text: string
  start: number
  end: number
}

// Split into sentences while keeping exact character offsets, so every quoted
// span this provider emits is verbatim by construction.
function splitSentences(content: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /[^.!?\n]+(?:[.!?]+|$)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const raw = match[0]
    const trimmed = raw.trim()
    if (trimmed.length >= 15) {
      const start = match.index + (raw.length - raw.trimStart().length)
      segments.push({ text: trimmed, start, end: start + trimmed.length })
    }
  }
  return segments
}

// The offline mock provider stands in for the language model when no API key
// is configured, keeping the whole workflow available. It only ever cites
// approved sources it was given and quotes verbatim spans of the draft, so the
// verifier can check every finding it produces.
export function mockReview(content: string, rules: Rule[], facts: Fact[], workspaceId = 'truemark-demo'): FindingDraft[] {
  const drafts: FindingDraft[] = []
  const indexes = getWorkspaceIndexes(workspaceId, rules, facts)
  const ruleIndex = indexes.ruleIndex
  const factIndex = indexes.factIndex
  const ruleById = indexes.rulesById
  const factById = indexes.factsById

  // How many approved rules mention each keyword — a keyword only one rule
  // uses is distinctive enough to justify a low-confidence finding on its own.
  const ruleKeywordCounts = new Map<string, number>()
  for (const rule of rules) {
    for (const token of new Set(tokenize(`${rule.title} ${rule.text}`))) {
      ruleKeywordCounts.set(token, (ruleKeywordCounts.get(token) ?? 0) + 1)
    }
  }

  // The demo library's citation rule; the mock stays data-driven by looking it
  // up by wording instead of hard-coding the code.
  const citationRule = rules.find((rule) => /statistic/i.test(rule.text))

  for (const segment of splitSentences(content)) {
    const ruleHits = ruleIndex.search(segment.text, 1)
    if (ruleHits.length > 0) {
      const hit = ruleHits[0]
      const rule = ruleById.get(hit.id)
      if (rule) {
        const segmentTokens = new Set(tokenize(segment.text))
        const distinctive = [...segmentTokens].some(
          (token) => token.length >= 4 && ruleKeywordCounts.get(token) === 1,
        )
        if (hit.overlap >= 2 || (hit.overlap === 1 && distinctive)) {
          drafts.push({
            sourceType: 'RULE',
            sourceId: rule.id,
            sourceCode: rule.code,
            quotedSpan: segment.text,
            spanStart: segment.start,
            spanEnd: segment.end,
            explanation: `This sentence may relate to "${rule.title}" (${rule.code}): ${rule.text} Confirm the draft follows the rule, or dismiss this finding.`,
            severity: 'LOW',
            confidence: Math.min(0.85, 0.6 + 0.05 * hit.overlap),
            origin: 'DETERMINISTIC',
          })
        }
      }
    }

    if (citationRule && /\b\d+(?:[.,]\d+)?%?\b/.test(segment.text)) {
      const factHits = factIndex.search(segment.text, 1)
      const fact = factHits.length > 0 ? factById.get(factHits[0].id) : undefined
      const strong = factHits.length > 0 && factHits[0].overlap >= 3
      drafts.push({
        sourceType: 'RULE',
        sourceId: citationRule.id,
        sourceCode: citationRule.code,
        quotedSpan: segment.text,
        spanStart: segment.start,
        spanEnd: segment.end,
        explanation: strong && fact
          ? `The draft states a figure, and approved fact ${fact.code} appears to correspond to it: "${fact.statement}" (source: ${fact.source}). Every statistic must cite an approved fact (${citationRule.code}).`
          : `The draft states a figure, and every statistic must cite an approved fact (${citationRule.code}).${
              fact
                ? ` The nearest approved fact is ${fact.code}: "${fact.statement}" (source: ${fact.source}). Confirm it supports this figure.`
                : ' No approved fact matches — add one to the library or remove the figure.'
            }`,
        severity: 'MEDIUM',
        confidence: strong ? 0.8 : 0.6,
        origin: 'DETERMINISTIC',
      })
    }
  }

  return drafts
}
