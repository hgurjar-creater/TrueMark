import { auditAccessibility, complexWordsIn } from './accessibility'

// Round 3: a live accessibility score for a submission. Unlike the stored
// accessibilityReview (computed once from the original text), this score is
// recomputed from the LATEST version content and the CURRENT finding
// decisions, so it visibly improves when a creator accepts or edits a
// suggested change and reflects image accessibility through the alt-text
// component.

export interface AccessibilityScoreInput {
  content: string
  hasImage: boolean
  altText: string | null
  findings: Array<{ sourceType: string; status: string }>
}

export interface ScoreComponent {
  label: string
  points: number
  max: number
  detail: string
}

export interface AccessibilityScore {
  score: number
  components: ScoreComponent[]
}

function readingEasePoints(readingEase: number | null, content: string): { points: number; detail: string } {
  const hard = complexWordsIn(content)
  const hardHint = hard.length
    ? ` Complex words to consider simplifying: ${hard.map((item) => `${item.word} (${item.syllables})`).join(', ')}.`
    : ''
  if (readingEase === null) return { points: 30, detail: 'Draft is too short to estimate reading ease.' }
  if (readingEase >= 80) return { points: 40, detail: `Reading ease ${readingEase}/100 — very easy to read.` }
  if (readingEase >= 70) return { points: 34, detail: `Reading ease ${readingEase}/100 — easy to read.` }
  if (readingEase >= 60) return { points: 28, detail: `Reading ease ${readingEase}/100 — plain English.${hardHint}` }
  if (readingEase >= 50) return { points: 20, detail: `Reading ease ${readingEase}/100 — fairly difficult.${hardHint}` }
  if (readingEase >= 30) return { points: 8, detail: `Reading ease ${readingEase}/100 — difficult.${hardHint}` }
  return { points: 0, detail: `Reading ease ${readingEase}/100 — very difficult.${hardHint}` }
}

export function computeAccessibilityScore(input: AccessibilityScoreInput): AccessibilityScore {
  const audit = auditAccessibility(input.content)

  const reading = readingEasePoints(audit.readingEase, input.content)

  const longSentences = audit.issues.filter((issue) => issue.category === 'SENTENCE_LENGTH').length
  const sentencePoints = longSentences === 0 ? 15 : longSentences === 1 ? 10 : longSentences === 2 ? 6 : 2

  const vagueLinks = audit.issues.filter((issue) => issue.category === 'LINK_TEXT').length
  const linkPoints = vagueLinks === 0 ? 15 : vagueLinks === 1 ? 8 : 3

  // Banned-term findings: an OPEN finding means the flagged wording is still
  // in the draft. Accepting or editing the fix creates a new version without
  // the wording and closes the finding, so both signals recover together.
  const termFindings = input.findings.filter((finding) => finding.sourceType === 'TERM')
  const openTerms = termFindings.filter((finding) => finding.status === 'OPEN').length
  const dismissedTerms = termFindings.filter((finding) => finding.status === 'DISMISSED').length
  const resolvedTerms = termFindings.filter((finding) => finding.status === 'ACCEPTED' || finding.status === 'EDITED').length
  const termPoints = Math.max(0, 15 - openTerms * 5 - dismissedTerms * 2)
  const termDetail =
    termFindings.length === 0
      ? 'No banned-term findings on this submission.'
      : `${resolvedTerms} resolved · ${openTerms} still open · ${dismissedTerms} dismissed with a recorded reason.`

  // Image accessibility: the component only applies when a creative is
  // attached — missing alt text is the accessibility gap the review checks.
  const altPoints = !input.hasImage
    ? 15
    : input.altText && input.altText.trim().length > 0
      ? 15
      : 0
  const altDetail = !input.hasImage
    ? 'No creative attached.'
    : altPoints === 15
      ? 'Alt text supplied for the creative.'
      : 'No alt text supplied for the attached creative.'

  const components: ScoreComponent[] = [
    { label: 'Reading ease', points: reading.points, max: 40, detail: reading.detail },
    { label: 'Sentence length', points: sentencePoints, max: 15, detail: longSentences === 0 ? 'All sentences within 25 words.' : `${longSentences} sentence(s) exceed 25 words.` },
    { label: 'Link text', points: linkPoints, max: 15, detail: vagueLinks === 0 ? 'No vague link labels.' : `${vagueLinks} vague link label(s).` },
    { label: 'Approved wording', points: termPoints, max: 15, detail: termDetail },
    { label: 'Creative alt text', points: altPoints, max: 15, detail: altDetail },
  ]

  const total = components.reduce((sum, component) => sum + component.points, 0)
  return { score: Math.max(0, Math.min(100, Math.round(total))), components }
}
