// Small labelled evaluation run for the demo workspace.
// Start the app with `npm run dev`, then run `node scripts/evaluate-review.mjs`.
import { readFile } from 'node:fs/promises'
import { PrismaClient } from '@prisma/client'
import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd())

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const email = process.env.EVAL_EMAIL ?? 'creator@truemark.test'
const password = process.env.EVAL_PASSWORD ?? 'truemark1234'
const cases = JSON.parse(await readFile(new URL('../evaluation/labelled-examples.json', import.meta.url), 'utf8'))
const db = new PrismaClient()

async function main() {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) throw new Error(`Login failed (${login.status}); set EVAL_EMAIL/EVAL_PASSWORD for the demo Creator.`)
  const cookie = login.headers.getSetCookie?.()[0]?.split(';')[0]
  if (!cookie) throw new Error('Login did not return a session cookie.')

  const evaluated = []
  for (const testCase of cases) {
    const response = await fetch(`${base}/api/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(testCase),
    })
    const body = await response.json()
    if (!response.ok || !body.id) throw new Error(`${testCase.id} failed to submit: ${body.error ?? response.status}`)
    const findings = await db.finding.findMany({
      where: { submissionId: body.id },
      include: { rule: true, fact: true, term: true, submission: { include: { versions: true } } },
    })
    evaluated.push({ testCase, submissionId: body.id, findings })
    console.log(`${testCase.id}: expected ${testCase.expectedSourceCodes.join(', ') || 'no findings'}; got ${findings.map((item) => item.sourceCode).join(', ') || 'no findings'}`)
  }

  const expected = new Set(evaluated.flatMap(({ testCase }) => testCase.expectedSourceCodes.map((code) => `${testCase.id}:${code}`)))
  const predicted = new Set(evaluated.flatMap(({ testCase, findings }) => findings.map((finding) => `${testCase.id}:${finding.sourceCode}`)))
  const truePositives = [...predicted].filter((key) => expected.has(key)).length
  const falsePositives = [...predicted].filter((key) => !expected.has(key)).length
  const falseNegatives = [...expected].filter((key) => !predicted.has(key)).length
  const validCitations = evaluated.flatMap(({ findings }) => findings).filter((finding) => {
    const version = finding.submission.versions.find((item) => item.versionNumber === finding.reviewedVersion)
    const approvedSource = finding.rule?.approved || finding.fact?.approved || finding.term?.approved
    return Boolean(approvedSource && version && finding.spanStart !== null && finding.spanEnd !== null && version.content.slice(finding.spanStart, finding.spanEnd) === finding.quotedSpan)
  }).length
  const totalFindings = evaluated.reduce((sum, item) => sum + item.findings.length, 0)
  const precision = truePositives + falsePositives ? truePositives / (truePositives + falsePositives) : 1
  const recall = expected.size ? truePositives / expected.size : 1
  const citationValidity = totalFindings ? validCitations / totalFindings : 1

  const metrics = {
    examples: cases.length,
    labelledFindings: expected.size,
    truePositives, falsePositives, falseNegatives,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    citationValidity: Number(citationValidity.toFixed(3)),
    createdSubmissionIds: evaluated.map((item) => item.submissionId),
    note: 'This small seeded set is a demonstrator, not a statistically representative benchmark. AI-model findings may vary between runs.',
  }
  console.log('\nEvaluation metrics')
  console.log(JSON.stringify(metrics, null, 2))
  await writeFileOutput(metrics)
}

async function writeFileOutput(metrics) {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(new URL('../evaluation/latest-results.json', import.meta.url), `${JSON.stringify(metrics, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => db.$disconnect())
