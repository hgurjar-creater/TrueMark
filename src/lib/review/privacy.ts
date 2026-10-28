export interface TextRange { start: number; end: number }

// Replace selected UTF-16 ranges with same-length blocks so source offsets
// remain stable for verification, while marked content is not sent to Gemini.
export function maskConfidentialRanges(content: string, ranges: TextRange[] = []) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  let result = content
  for (const range of [...sorted].reverse()) {
    if (range.start < 0 || range.end > result.length || range.end <= range.start) continue
    const original = result.slice(range.start, range.end)
    const masked = original.split('').map((character) => /\r|\n/.test(character) ? character : '█').join('')
    result = `${result.slice(0, range.start)}${masked}${result.slice(range.end)}`
  }
  return { text: result, count: sorted.length }
}
