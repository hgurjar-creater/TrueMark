// Round 3 commitment 2 report: intent-preserving fix suggestions.
// Reads evaluation/creator-tests.json (filled during the five creator test
// sessions), validates it, computes the acceptance rate and writes
// evaluation/creator-test-results.json for the final PDF.
//
// Usage: node scripts/creator-test-report.mjs
import { readFile, writeFile } from 'node:fs/promises'

const data = JSON.parse(await readFile(new URL('../evaluation/creator-tests.json', import.meta.url), 'utf8'))

const participants = data.participants ?? []
if (participants.length === 0) {
  console.error('No participants recorded yet. Fill evaluation/creator-tests.json after the test sessions (see evaluation/creator-test-protocol.md).')
  process.exit(1)
}

const counts = { ACCEPTED: 0, EDITED: 0, DISMISSED: 0 }
let totalSuggestions = 0
const rows = []

for (const participant of participants) {
  const suggestionCount = (participant.suggestions ?? []).length
  if (!participant.participant || suggestionCount === 0) {
    console.error(`Participant entry is incomplete: ${JSON.stringify(participant).slice(0, 120)}`)
    process.exit(1)
  }
  for (const suggestion of participant.suggestions) {
    if (!(suggestion.decision in counts)) {
      console.error(`Unknown decision "${suggestion.decision}" for ${participant.participant}. Use ACCEPTED, EDITED or DISMISSED.`)
      process.exit(1)
    }
    counts[suggestion.decision] += 1
    totalSuggestions += 1
  }
  const acceptedOrEdited = (participant.suggestions ?? []).filter((s) => s.decision === 'ACCEPTED' || s.decision === 'EDITED').length
  rows.push({
    participant: participant.participant,
    background: participant.background ?? null,
    priorUse: participant.priorUse ?? null,
    completionMinutes: participant.completionMinutes ?? null,
    suggestions: suggestionCount,
    acceptedOrEdited: acceptedOrEdited,
    intentPreserved: participant.intentPreserved ?? null,
    feedback: participant.feedback ?? null,
  })
}

const acceptedOrEditedTotal = counts.ACCEPTED + counts.EDITED
const rate = totalSuggestions ? Number((acceptedOrEditedTotal / totalSuggestions).toFixed(4)) : null
const intentYesOrPartly = rows.filter((row) => row.intentPreserved === 'yes' || row.intentPreserved === 'partly').length

const result = {
  target: 'At least 60% of suggestions accepted or lightly edited across five creator tests.',
  method: data.method,
  definition: data.definition,
  sampleSize: participants.length,
  totalSuggestions,
  accepted: counts.ACCEPTED,
  lightlyEdited: counts.EDITED,
  dismissed: counts.DISMISSED,
  acceptedOrEditedTotal,
  acceptanceRate: rate,
  targetMet: rate !== null ? rate >= 0.6 : false,
  intentPreservedYesOrPartly: `${intentYesOrPartly} of ${rows.length}`,
  participants: rows,
  limitations:
    'Five participants and one prepared draft per session; a facilitator was present; the demo guidance library was used. The result indicates usability of the suggestion feature for this sample and is not a general accuracy claim.',
  generatedAt: new Date().toISOString(),
}

await writeFile(new URL('../evaluation/creator-test-results.json', import.meta.url), JSON.stringify(result, null, 2))

console.log(`Participants           : ${result.sampleSize}`)
console.log(`Suggestions shown      : ${totalSuggestions}`)
console.log(`Accepted               : ${counts.ACCEPTED}`)
console.log(`Lightly edited         : ${counts.EDITED}`)
console.log(`Dismissed              : ${counts.DISMISSED}`)
console.log(`Acceptance rate        : ${rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`} (target >= 60%) -> ${result.targetMet ? 'TARGET MET' : 'TARGET NOT MET'}`)
console.log(`Intent preserved       : ${result.intentPreservedYesOrPartly}`)
console.log('Saved to evaluation/creator-test-results.json')
