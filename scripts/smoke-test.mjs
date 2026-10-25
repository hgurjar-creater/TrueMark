// TrueMark end-to-end smoke test. Requires the production server to be
// running:  npm run build && npm run start  then in another shell:
//  node scripts/smoke-test.mjs
//
// Exercises the complete Round 2 path: login, submission with automated
// review, accept/edit/dismiss decisions, manager comment and approval, role
// restrictions, versioning and the audit trail. Creates demo data you can
// show judges.

import { PrismaClient } from '@prisma/client'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
process.env.DATABASE_URL ??= 'file:./prisma/dev.db'
const db = new PrismaClient()

const DEMO_PASSWORD = 'truemark123'

let cookie = ''
let failures = 0

function assert(condition, label) {
  if (condition) {
    console.log(`  ok  ${label}`)
  } else {
    failures += 1
    console.error(`FAIL  ${label}`)
  }
}

async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {}),
    },
  })
  const setCookie = res.headers.getSetCookie?.()
  if (setCookie && setCookie.length > 0) {
    cookie = setCookie[0].split(';')[0]
  }
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body }
}

async function login(email) {
  cookie = ''
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  })
  assert(res.status === 200, `login as ${email}`)
}

const LAUNCH_DRAFT = [
  'TrueMark is the best tool on the market for brand governance.',
  'Our cheap free tier gives every team 50 reviews per month, guaranteed.',
  'Teams using TrueMark published 40% fewer off-brand posts during the pilot.',
  'Act now and join the 12 pilot organisations before publication deadlines slip.',
  'Revolutionary AI-powered checks that write plain sentences.',
].join(' ')

const PRESS_DRAFT = [
  'TrueMark today announced the launch of its free tier for student clubs and small teams.',
  'The cheap plan gives clubs 50 reviews per month.',
  'Sign-up is open on the product page.',
].join(' ')

async function main() {
  console.log(`Smoke test against ${BASE}`)

  // 1. Creator submits a draft that trips terms, rules and facts.
  await login('creator@truemark.test')
  const created = await api('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Launch post for our free tier',
      channel: 'LinkedIn',
      purpose: 'Announce the free tier and drive sign-ups.',
      content: LAUNCH_DRAFT,
    }),
  })
  assert(created.status === 201, 'submission created (201)')
  assert(created.body.findings >= 8, `review produced findings (${created.body.findings})`)
  const submissionId = created.body.id

  const page = await api(`/submissions/${submissionId}`)
  assert(page.status === 200 && page.body.includes('Findings'), 'review interface renders')

  const launch = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { findings: true, versions: true },
  })
  const openByCode = (code) =>
    launch.findings.find((f) => f.sourceCode === code && f.status === 'OPEN')
  assert(launch.findings.some((f) => f.sourceType === 'TERM' && f.confidence === 1), 'deterministic term findings present')
  assert(launch.findings.some((f) => f.sourceType === 'RULE' && f.sourceCode === 'R-004'), 'statistic citation findings present')
  assert(launch.versions.length === 1, 'version 1 recorded')

  // 2. Role restrictions.
  await login('manager@truemark.test')
  const t002 = openByCode('T-002')
  const forbiddenDecision = await api(`/api/findings/${t002.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'ACCEPT' }),
  })
  assert(forbiddenDecision.status === 403, 'manager cannot decide creator findings (403)')

  await login('creator@truemark.test')
  const forbiddenApproval = await api(`/api/submissions/${submissionId}/approval`, {
    method: 'POST',
    body: JSON.stringify({ action: 'APPROVE' }),
  })
  assert(forbiddenApproval.status === 403, 'creator cannot approve (403)')

  // 3. Accept the T-001 suggested change -> version 2.
  const t001 = openByCode('T-001')
  const accept = await api(`/api/findings/${t001.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'ACCEPT' }),
  })
  assert(accept.status === 200 && accept.body.versionNumber === 2, 'accepted T-001 creates version 2')
  const v2 = await db.version.findUniqueOrThrow({
    where: { submissionId_versionNumber: { submissionId, versionNumber: 2 } },
  })
  assert(v2.content.includes('cost-effective') && !v2.content.includes('cheap'), 'version 2 applies the replacement')

  // 4. Edit the T-003 fix by hand -> version 3.
  const t003 = openByCode('T-003')
  const edit = await api(`/api/findings/${t003.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'EDIT', replacement: 'new' }),
  })
  assert(edit.status === 200 && edit.body.versionNumber === 3, 'edited T-003 creates version 3')
  const v3 = await db.version.findUniqueOrThrow({
    where: { submissionId_versionNumber: { submissionId, versionNumber: 3 } },
  })
  assert(v3.content.includes('new AI-powered'), 'version 3 applies the hand-typed replacement')

  // 5. Dismiss the R-005 finding with a reason.
  const r005 = openByCode('R-005')
  const dismiss = await api(`/api/findings/${r005.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'DISMISS', note: 'Intentional style for this launch post.' }),
  })
  assert(dismiss.status === 200, 'dismissed R-005 with a reason')
  const dismissalWithoutNote = await api(`/api/findings/${openByCode('R-006').id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'DISMISS' }),
  })
  assert(dismissalWithoutNote.status === 422, 'dismissal without a reason is rejected (422)')

  // 6. Manager comments and requests changes.
  await login('manager@truemark.test')
  const comment = await api(`/api/submissions/${submissionId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: 'Please soften the urgency before we approve this.' }),
  })
  assert(comment.status === 201, 'manager comment posted')
  const requestChanges = await api(`/api/submissions/${submissionId}/approval`, {
    method: 'POST',
    body: JSON.stringify({ action: 'REQUEST_CHANGES', comment: 'Too pushy for LinkedIn.' }),
  })
  assert(requestChanges.status === 200, 'manager requested changes')
  const afterRequest = await db.submission.findUniqueOrThrow({ where: { id: submissionId } })
  assert(afterRequest.status === 'CHANGES_REQUESTED', 'status is CHANGES_REQUESTED')

  // 7. Creator acts on a finding -> back to IN_REVIEW.
  await login('creator@truemark.test')
  const acceptAfterRequest = await api(`/api/findings/${t002.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'ACCEPT' }),
  })
  assert(acceptAfterRequest.status === 200 && acceptAfterRequest.body.versionNumber === 4, 'accepting a finding creates version 4')
  const afterFix = await db.submission.findUniqueOrThrow({ where: { id: submissionId } })
  assert(afterFix.status === 'IN_REVIEW', 'status returns to IN_REVIEW after a revision')

  // 8. Manager approves.
  await login('manager@truemark.test')
  const approve = await api(`/api/submissions/${submissionId}/approval`, {
    method: 'POST',
    body: JSON.stringify({ action: 'APPROVE' }),
  })
  assert(approve.status === 200, 'manager approved')
  const approved = await db.submission.findUniqueOrThrow({ where: { id: submissionId } })
  assert(approved.status === 'APPROVED', 'status is APPROVED')

  // 9. A second submission left open for the live demo.
  await login('creator@truemark.test')
  const second = await api('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Press release: free tier for student clubs',
      channel: 'Press release',
      purpose: 'Announce the free tier to student media.',
      content: PRESS_DRAFT,
    }),
  })
  assert(second.status === 201, 'second submission created (201)')
  const press = await db.submission.findUniqueOrThrow({
    where: { id: second.body.id },
    include: { findings: true },
  })
  assert(press.findings.some((f) => f.sourceCode === 'T-001' && f.status === 'OPEN'), 'press release has an open T-001 finding for the live demo')

  // 10. Admin overview renders and the audit trail recorded everything.
  await login('admin@truemark.test')
  const adminPage = await api('/admin')
  assert(adminPage.status === 200 && adminPage.body.includes('Admin panel'), 'admin overview renders')

  // Finding decisions are audited under their own entity (the Finding) with
  // the submission id in metadata; submission-level actions under the
  // Submission entity. Cover both when verifying the trail.
  const audits = await db.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'Submission', entityId: submissionId },
        { entityType: 'Finding', metadata: { contains: submissionId } },
      ],
    },
  })
  const actions = new Set(audits.map((entry) => entry.action))
  for (const expected of [
    'SUBMISSION_CREATED',
    'REVIEW_COMPLETED',
    'SUBMISSION_VERSION_CREATED',
    'FINDING_ACCEPTED',
    'FINDING_EDITED',
    'FINDING_DISMISSED',
    'CHANGES_REQUESTED',
    'SUBMISSION_APPROVED',
  ]) {
    assert(actions.has(expected), `audit trail recorded ${expected}`)
  }

  const aiLogs = await db.aiCallLog.count({ where: { provider: 'mock' } })
  assert(aiLogs >= 2, `AI-use disclosure log has entries (${aiLogs})`)

  console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
