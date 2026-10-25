const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'is', 'it', 'its',
  'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'must', 'should', 'such', 'this',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

export interface ScoredDocument {
  id: string
  score: number
  overlap: number // distinct query terms present in the document
}

interface IndexedDocument {
  id: string
  length: number
  counts: Map<string, number>
}

// Compact BM25 over the approved library. Round 2 only needs top-1 candidate
// selection per draft segment; no hosted vector service is involved.
export class Bm25Index {
  private readonly docs: IndexedDocument[]
  private readonly docFrequency: Map<string, number>
  private readonly avgLength: number

  constructor(documents: { id: string; text: string }[]) {
    const tokenized = documents.map((doc) => {
      const tokens = tokenize(doc.text)
      const counts = new Map<string, number>()
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
      return { id: doc.id, tokens, counts, length: tokens.length }
    })

    this.docs = tokenized.map(({ id, counts, length }) => ({ id, counts, length }))

    this.docFrequency = new Map()
    for (const doc of tokenized) {
      for (const token of new Set(doc.tokens)) {
        this.docFrequency.set(token, (this.docFrequency.get(token) ?? 0) + 1)
      }
    }

    this.avgLength =
      this.docs.length > 0
        ? this.docs.reduce((sum, doc) => sum + doc.length, 0) / this.docs.length
        : 0
  }

  search(query: string, topK = 1): ScoredDocument[] {
    const queryTokens = [...new Set(tokenize(query))]
    const k1 = 1.5
    const b = 0.75
    const n = this.docs.length
    const scored = this.docs.map((doc) => {
      let score = 0
      let overlap = 0
      for (const token of queryTokens) {
        const tf = doc.counts.get(token)
        if (!tf) continue
        overlap += 1
        const df = this.docFrequency.get(token) ?? 0
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
        score +=
          idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (doc.length / (this.avgLength || 1)))))
      }
      return { id: doc.id, score, overlap }
    })
    return scored
      .filter((entry) => entry.overlap > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}
