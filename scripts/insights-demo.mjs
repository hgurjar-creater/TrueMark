// Round 3 commitment 3 measurement: guideline-gap insights.
// Seeds an isolated evaluation workspace with 5 deliberately UNCLEAR rules and
// 3 precise CONTROL rules, records 5 decisions on each (60% dismissal for the
// unclear rules, 0% for the controls), then measures how many unclear rules
// the insight engine surfaces and whether any control rule is a false
// positive. Target: at least 4 of 5 unclear rules surfaced.
//
// Start the app (npm run dev), then: node scripts/insights-demo.mjs
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const db = new PrismaClient()

const WORKSPACE_NAME = 'Round 3 Insights Evaluation'
const ADMIN_EMAIL = 'insights-admin@truemark.test'
const CREATOR_EMAIL = 'insights-creator@truemark.test'
const PASSWORD = 'truemark1234'

const UNCLEAR_RULES = [
  { code: 'U-001', title: 'Use the right tone', text: 'Content should feel appropriate to the audience.' },
  { code: 'U-002', title: 'Be creative', text: 'Posts should show creativity where suitable.' },
  { code: 'U-003', title: 'Stay on brand', text: 'Keep the design and message consistent with the brand.' },
  { code: 'U-004', title: 'Engage naturally', text: 'Captions should engage the audience in a natural way.' },
  { code: 'U-005', title: 'Maintain quality', text: 'All published work must meet quality expectations.' },
]

const CONTROL_RULES = [
  { code: 'C-001', title: 'Brand name format', text: 'Always write the brand name as "TrueMark" — never "Truemark" or "True Mark".' },
  { code: 'C-002', title: 'No pricing without citation', text: 'Never state a price without citing approved fact F-002.' },
  { code: 'C-003', title: 'Banned word', text: 'The word "cheap" is banned; use "value for money" instead.' },
]

// Unclear rules: 3 of 5 decisions dismissed (60% — above the 40% threshold).
// Controls: never dismissed (0% — must NOT surface).
const DECISION_PATTERN = ['DISMISSED', 'ACCEPTED', 'DISMISSED', 'DISMISSED', 'ACCEPTED']

async function main() {
  // 1. Idempotent reset: remove any previous run of this evaluation workspace.
  const staleUsers = await db.user.findMany({ where: { email: { in: [ADMIN_EMAIL, CREATOR_EMAIL] } } })
  const staleWorkspaceIds = [...new Set(staleUsers.map((user) => user.workspaceId).filter(Boolean))]
  for (const workspaceId of staleWorkspaceIds) {
    const submissions = await db.submission.findMany({ where: { workspaceId }, select: { id: true } })
    for (const submission of submissions) {
      await db.finding.deleteMany({ where: { submissionId: submission.id } })
      await db.version.deleteMany({ where: { submissionId: submission.id } })
      await db.comment.deleteMany({ where: { submissionId: submission.id } })
      await db.aiCallLog.deleteMany({ where: { submissionId: submission.id } })
      await db.reviewJob.deleteMany({ where: { submissionId: submission.id } })
      await db.feedback.deleteMany({ where: { submissionId: submission.id } })
    }
    await db.submission.deleteMany({ where: { workspaceId } })
    await db.rule.deleteMany({ where: { workspaceId } })
    await db.fact.deleteMany({ where: { workspaceId } })
    await db.term.deleteMany({ where: { workspaceId } })
    await db.brandProfile.deleteMany({ where: { workspaceId } })
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: staleUsers.map((u) => u.id) } }, { entityType: 'Workspace', entityId: workspaceId }] } })
    await db.workspace.delete({ where: { id: workspaceId } })
  }
  await db.user.deleteMany({ where: { email: { in: [ADMIN_EMAIL, CREATOR_EMAIL] } } })

  // 2. Seed the isolated workspace, users and guidance.
  const workspace = await db.workspace.create({ data: { name: WORKSPACE_NAME } })
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const admin = await db.user.create({ data: { name: 'Insights Admin', email: ADMIN_EMAIL, passwordHash, role: 'ADMIN', workspaceId: workspace.id } })
  const creator = await db.user.create({ data: { name: 'Insights Creator', email: CREATOR_EMAIL, passwordHash, role: 'CREATOR', workspaceId: workspace.id } })

  const allRules = [...UNCLEAR_RULES, ...CONTROL_RULES]
  const createdRules = {}
  for (const rule of allRules) {
    createdRules[rule.code] = await db.rule.create({
      data: { code: rule.code, title: rule.title, text: rule.text, category: 'Insights evaluation', approved: true, workspaceId: workspace.id },
    })
  }

  // 3. Five submissions, each carrying one finding per rule, with decisions.
  for (let round = 1; round <= 5; round += 1) {
    const submission = await db.submission.create({
      data: {
        title: `Insights evaluation draft ${round}`,
        content: `Evaluation draft ${round}: the team reviewed tone, creativity, brand consistency, engagement and quality, alongside the brand name, pricing citation and word-choice controls.`,
        channel: 'Blog post',
        purpose: 'Generate five recorded decisions per guidance source for the Round 3 insight measurement.',
        status: 'APPROVED',
        reviewStatus: 'COMPLETED',
        creatorId: creator.id,
        workspaceId: workspace.id,
      },
    })
    await db.version.create({
      data: { submissionId: submission.id, versionNumber: 1, content: submission.content, createdById: creator.id, note: 'Original submission.' },
    })
    for (const rule of allRules) {
      const dismissed = DECISION_PATTERN[round - 1] === 'DISMISSED' && UNCLEAR_RULES.some((item) => item.code === rule.code)
      await db.finding.create({
        data: {
          submissionId: submission.id,
          reviewedVersion: 1,
          sourceType: 'RULE',
          ruleId: createdRules[rule.code].id,
          sourceCode: rule.code,
          quotedSpan: submission.content.slice(0, 40),
          spanStart: 0,
          spanEnd: 40,
          explanation: `${rule.title}: candidate finding for the insight measurement.`,
          severity: 'LOW',
          confidence: 0.7,
          origin: 'DETERMINISTIC',
          status: dismissed ? 'DISMISSED' : 'ACCEPTED',
          decidedById: creator.id,
          decisionNote: dismissed ? `Round ${round}: this guidance is too vague to apply here.` : null,
        },
      })
    }
  }

  const decisionTotal = await db.finding.count({ where: { submission: { is: { workspaceId: workspace.id } }, status: { not: 'OPEN' } } })
  console.log(`Seeded ${allRules.length} rules with ${decisionTotal} recorded decisions in "${WORKSPACE_NAME}".`)

  // 4. Measure through the real admin API surface.
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }),
  })
  if (!login.ok) throw new Error(`Insights admin login failed (${login.status}).`)
  const cookie = login.headers.getSetCookie?.()[0]?.split(';')[0]
  const response = await fetch(`${base}/api/admin/insights`, { headers: { cookie } })
  if (!response.ok) throw new Error(`Insights request failed (${response.status}).`)
  const body = await response.json()
  const surfaced = (body.insights ?? []).map((item) => item.sourceCode)

  const expectedUnclear = UNCLEAR_RULES.map((rule) => rule.code)
  const surfacedUnclear = expectedUnclear.filter((code) => surfaced.includes(code))
  const falsePositives = surfaced.filter((code) => !expectedUnclear.includes(code))

  const result = {
    target: 'Surface at least 4 of 5 seeded unclear rules; report false positives.',
    workspace: WORKSPACE_NAME,
    seededUnclearRules: expectedUnclear,
    controlRules: CONTROL_RULES.map((rule) => rule.code),
    decisionsPerRule: 5,
    dismissalPattern: '60% for unclear rules, 0% for controls',
    surfacedInsights: surfaced,
    surfacedUnclearCount: surfacedUnclear.length,
    targetMet: surfacedUnclear.length >= 4,
    falsePositives,
    insightDetails: body.insights ?? [],
    generatedAt: new Date().toISOString(),
  }

  const { writeFile } = await import('node:fs/promises')
  await writeFile(new URL('../evaluation/insights-results.json', import.meta.url), JSON.stringify(result, null, 2))

  console.log(`Surfaced insights : ${surfaced.join(', ') || 'none'}`)
  console.log(`Unclear surfaced  : ${surfacedUnclear.length} of 5 (target >= 4) -> ${result.targetMet ? 'TARGET MET' : 'TARGET NOT MET'}`)
  console.log(`False positives   : ${falsePositives.join(', ') || 'none'}`)
  console.log('Saved to evaluation/insights-results.json')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
