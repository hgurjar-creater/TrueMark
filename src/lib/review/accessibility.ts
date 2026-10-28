export interface AccessibilityIssue {
  category: 'READABILITY' | 'SENTENCE_LENGTH' | 'LINK_TEXT' | 'ALT_TEXT'
  severity: 'LOW' | 'MEDIUM'
  message: string
  evidence: string
  recommendation: string
}

export interface AccessibilityReport {
  wordCount: number
  sentenceCount: number
  averageWordsPerSentence: number
  readingEase: number | null
  readingLevel: string
  issues: AccessibilityIssue[]
}

function syllableEstimate(word: string) {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, '')
  if (normalized.length < 4) return 1
  const groups = normalized.match(/[aeiouy]+/g)?.length ?? 1
  const silentE = normalized.endsWith('e') && !normalized.endsWith('le') ? 1 : 0
  return Math.max(1, groups - silentE)
}

function levelFor(score: number | null) {
  if (score === null) return 'Not enough text to estimate'
  if (score >= 90) return 'Very easy'
  if (score >= 80) return 'Easy'
  if (score >= 70) return 'Fairly easy'
  if (score >= 60) return 'Plain English'
  if (score >= 50) return 'Fairly difficult'
  if (score >= 30) return 'Difficult'
  return 'Very difficult'
}

export function auditAccessibility(content: string, altText?: string | null): AccessibilityReport {
  const clean = content.replace(/https?:\/\/\S+/g, ' ').trim()
  const words = clean.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []
  const sentences = clean.split(/[.!?]+(?:\s|$)/).map((sentence) => sentence.trim()).filter(Boolean)
  const sentenceCount = Math.max(1, sentences.length)
  const averageWordsPerSentence = Math.round((words.length / sentenceCount) * 10) / 10
  const syllables = words.reduce((sum, word) => sum + syllableEstimate(word), 0)
  const score = words.length >= 20
    ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (words.length / sentenceCount) - 84.6 * (syllables / words.length))))
    : null

  const issues: AccessibilityIssue[] = []
  if (score !== null && score < 60) {
    issues.push({
      category: 'READABILITY', severity: score < 40 ? 'MEDIUM' : 'LOW',
      message: `Estimated reading ease is ${score}/100 (${levelFor(score)}).`,
      evidence: 'This estimate uses sentence length and an English syllable heuristic; names and technical terms can affect it.',
      recommendation: 'Prefer familiar words and shorter phrasing where that preserves the intended meaning.',
    })
  }
  for (const sentence of sentences.filter((item) => (item.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []).length > 25).slice(0, 5)) {
    issues.push({
      category: 'SENTENCE_LENGTH', severity: 'LOW',
      message: 'This sentence is longer than 25 words.',
      evidence: sentence.slice(0, 240),
      recommendation: 'Consider splitting it into two sentences so readers can follow the idea more easily.',
    })
  }
  const vagueLinks = [...content.matchAll(/\[([^\]]+)\]\([^)]+\)/g)]
    .map((match) => match[1])
    .filter((label) => /^(click here|here|read more|more|link)$/i.test(label.trim()))
  if (vagueLinks.length) {
    issues.push({
      category: 'LINK_TEXT', severity: 'MEDIUM',
      message: `${vagueLinks.length} link${vagueLinks.length === 1 ? '' : 's'} use vague text (${vagueLinks.slice(0, 3).map((label) => `“${label}”`).join(', ')}).`,
      evidence: 'Link text should make sense when read on its own, including in a screen-reader links list.',
      recommendation: 'Replace generic labels with the destination or action, such as “Read the refund policy”.',
    })
  }
  if (altText !== null && altText !== undefined && !altText.trim()) {
    issues.push({
      category: 'ALT_TEXT', severity: 'LOW',
      message: 'No alternative text was supplied for the creative.',
      evidence: 'The submitted image has no creator-provided description.',
      recommendation: 'Add concise alt text describing the meaningful information in the image; use empty alt text only when it is decorative.',
    })
  }

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    averageWordsPerSentence,
    readingEase: score,
    readingLevel: levelFor(score),
    issues,
  }
}
