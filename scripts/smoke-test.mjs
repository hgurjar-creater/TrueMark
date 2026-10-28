// TrueMark end-to-end smoke test. Requires the production server to be
// running:  npm run build && npm run start  then in another shell:
//  node scripts/smoke-test.mjs
//
// Exercises the complete Round 2 path: login, submission with automated
// review, accept/edit/dismiss decisions, manager comment and approval, role
// restrictions, versioning and the audit trail. Creates demo data you can
// show judges.

import { PrismaClient } from '@prisma/client'
import sharp from 'sharp'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
process.env.DATABASE_URL ??= 'file:./prisma/dev.db'
const db = new PrismaClient()

const DEMO_PASSWORD = 'truemark1234'

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

async function login(email, password = DEMO_PASSWORD) {
  cookie = ''
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
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
  // The four banned terms always produce deterministic findings; how much more
  // the provider (Gemini or mock) adds varies.
  assert(created.body.findings >= 4, `review produced findings (${created.body.findings})`)
  const submissionId = created.body.id

  const page = await api(`/submissions/${submissionId}`)
  assert(page.status === 200 && page.body.includes('Findings'), 'review interface renders')
  const reportPage = await api(`/submissions/${submissionId}/report`)
  assert(reportPage.status === 200 && reportPage.body.includes('Brand review record'), 'print-ready review report renders')

  const launch = await db.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { findings: true, versions: true },
  })
  const openByCode = (code) =>
    launch.findings.find((f) => f.sourceCode === code && f.status === 'OPEN')
  assert(launch.findings.some((f) => f.sourceType === 'TERM' && f.confidence === 1), 'deterministic term findings present')
  const knownCodes = new Set([
    'R-001', 'R-002', 'R-003', 'R-004', 'R-005', 'R-006', 'R-007', 'R-008',
    'F-001', 'F-002', 'F-003', 'F-004', 'F-005',
    'T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006',
  ])
  assert(launch.findings.length > 0 && launch.findings.every((f) => knownCodes.has(f.sourceCode)), 'every finding cites a known approved source code')
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

  // 5. Dismiss a finding with a reason. Provider findings vary (Gemini vs
  // mock), so pick any open finding except the three reserved term findings:
  // T-002 is accepted later; T-001 and T-003 are already decided.
  const reserved = new Set(['T-001', 'T-002', 'T-003'])
  const toDismiss = launch.findings.find((f) => f.status === 'OPEN' && !reserved.has(f.sourceCode))
  assert(!!toDismiss, 'a dismissible finding is available')
  const dismiss = await api(`/api/findings/${toDismiss.id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ action: 'DISMISS', note: 'Intentional style for this launch post.' }),
  })
  assert(dismiss.status === 200, 'dismissed a finding with a reason')
  const toDismissWithoutNote = launch.findings.find(
    (f) => f.status === 'OPEN' && f.id !== toDismiss.id && !reserved.has(f.sourceCode),
  )
  if (toDismissWithoutNote) {
    const dismissalWithoutNote = await api(`/api/findings/${toDismissWithoutNote.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ action: 'DISMISS' }),
    })
    assert(dismissalWithoutNote.status === 422, 'dismissal without a reason is rejected (422)')
  }

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

  // 10. Super Admin provisions separate brand workspaces and Admins. Each
  // brand Admin is restricted to its own users, content and submissions.
  const smokeTag = Date.now()
  const brandAdminEmail = `smoke-brand-admin-${smokeTag}@truemark.test`
  await login('superadmin@truemark.test')
  const superAdminPage = await api('/superadmin')
  assert(superAdminPage.status === 200 && superAdminPage.body.includes('Super Admin portal'), 'Super Admin opens its portal')
  const brand = await api('/api/superadmin/workspaces', {
    method: 'POST', body: JSON.stringify({ brandName: 'Smoke Brand', adminName: 'Smoke Brand Admin', adminEmail: brandAdminEmail, temporaryPassword: 'SmokeBrandAdmin123!' }),
  })
  assert(brand.status === 201 && brand.body.workspace?.name === 'Smoke Brand', 'Super Admin creates a brand workspace and Admin')

  const closedRegistration = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'Late Signup', email: `late-signup-${smokeTag}@truemark.test`, password: DEMO_PASSWORD }),
  })
  assert(closedRegistration.status === 403, 'registration stays closed after Super Admin setup (403)')

  const wrongPortal = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@truemark.test', password: DEMO_PASSWORD, expectedRole: 'ADMIN' }),
  })
  assert(wrongPortal.status === 401, 'role-specific portal rejects a mismatched role (401)')

  await login('admin@truemark.test')
  const adminPage = await api('/admin')
  assert(adminPage.status === 200 && adminPage.body.includes('Admin panel'), 'brand Admin opens the admin portal')
  const profile = await api('/api/admin/brand-profile')
  assert(profile.status === 200 && profile.body.profile.palette.length >= 1 && Boolean(profile.body.profile.logoPreview), 'Admin can view private logo and palette references')

  const createdWorkspaceUser = await api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke Workspace Creator', email: `smoke-creator-${smokeTag}@truemark.test`, password: DEMO_PASSWORD, role: 'CREATOR' }),
  })
  assert(createdWorkspaceUser.status === 201 && createdWorkspaceUser.body.user.role === 'CREATOR', 'Admin creates a Creator account')
  const createdManager = await api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke Workspace Manager', email: `smoke-manager-${smokeTag}@truemark.test`, password: DEMO_PASSWORD, role: 'MANAGER' }),
  })
  assert(createdManager.status === 201 && createdManager.body.user.role === 'MANAGER', 'Admin creates a Manager account')
  const escalatedAccount = await api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke Escalation', email: `smoke-escalation-${smokeTag}@truemark.test`, password: DEMO_PASSWORD, role: 'ADMIN' }),
  })
  assert(escalatedAccount.status === 422, 'Admin cannot provision another Admin')

  const adminFeedbackDenied = await api('/api/admin/feedback')
  assert(adminFeedbackDenied.status === 403, 'brand Admin cannot view cross-brand product feedback')
  await login(brandAdminEmail, 'SmokeBrandAdmin123!')
  const otherBrandPage = await api(`/submissions/${second.body.id}`)
  assert(otherBrandPage.status === 404, 'brand Admin cannot view a different brand submission')
  const newBrandProfile = await api('/api/admin/brand-profile')
  assert(newBrandProfile.status === 200 && newBrandProfile.body.profile.name === 'Smoke Brand', 'new Admin receives its own brand profile')
  await login('superadmin@truemark.test')
  const allFeedback = await api('/api/superadmin/feedback')
  assert(allFeedback.status === 200 && Array.isArray(allFeedback.body.feedback), 'Super Admin can view platform feedback')
  await login('admin@truemark.test')

  const evaluation = await api('/api/admin/evaluation', { method: 'POST' })
  assert(evaluation.status === 200 && evaluation.body.casesRun === 4 && evaluation.body.citationValidity === 1, 'labelled evaluation set reports precision, recall and verified citations')

  // 11. File uploads: draft extraction works, and imported library items land
  // as drafts with the next free codes.
  await login('creator@truemark.test')
  const draftFile = new File(['This launch post was uploaded as a file for extraction testing.'], 'draft.txt', { type: 'text/plain' })
  const draftForm = new FormData()
  draftForm.append('file', draftFile)
  const extracted = await fetch(`${BASE}/api/submissions/extract`, {
    method: 'POST',
    headers: { cookie },
    body: draftForm,
  })
  const extractedBody = await extracted.json()
  assert(extracted.status === 200 && extractedBody.text.startsWith('This launch post'), 'draft file text extracted (txt upload)')

  const privateDraft = 'Contact our private address confidential@example.com before publication. This remains available only in the workspace review record.'
  const privateStart = privateDraft.indexOf('confidential@example.com')
  const privateSubmission = await api('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Confidential span check', channel: 'Blog post',
      purpose: 'Verify private text is masked before external review.', content: privateDraft,
      confidentialSpans: [{ start: privateStart, end: privateStart + 'confidential@example.com'.length }],
    }),
  })
  const privateRecord = await db.submission.findUnique({ where: { id: privateSubmission.body.id } })
  assert(privateSubmission.status === 201 && privateRecord?.content.includes('confidential@example.com') && Boolean(privateRecord.confidentialSpans), 'marked confidential text stays in the private review record')

  const creativeBuffer = await sharp({ create: { width: 160, height: 110, channels: 3, background: '#D84058' } }).png().toBuffer()
  const visualForm = new FormData()
  visualForm.set('title', 'Visual brand consistency smoke check')
  visualForm.set('channel', 'Instagram')
  visualForm.set('purpose', 'Check the uploaded creative against the workspace logo and palette.')
  visualForm.set('content', 'The implementation of comprehensive organizational strategies facilitates the synchronization of multidisciplinary promotional communication across operational stakeholders before public distribution while maintaining consistent positioning across external channels and supplementary campaigns.')
  visualForm.set('imageAltText', 'A red square sample creative used for visual consistency testing.')
  visualForm.set('image', new File([creativeBuffer], 'sample-creative.png', { type: 'image/png' }))
  const visualResponse = await fetch(`${BASE}/api/submissions`, { method: 'POST', headers: { cookie }, body: visualForm })
  const visualBody = await visualResponse.json()
  assert(visualResponse.status === 201 && Boolean(visualBody.id), 'image creative accepted and reviewed through the submission flow')
  const visualRecord = visualBody.id ? await db.submission.findUnique({ where: { id: visualBody.id } }) : null
  const visualReport = visualRecord?.visualReview ? JSON.parse(visualRecord.visualReview) : null
  const accessibility = visualRecord?.accessibilityReview ? JSON.parse(visualRecord.accessibilityReview) : null
  assert(Boolean(visualRecord?.imageData && visualReport?.width === 160 && visualReport?.dominantColors?.length), 'image, dimensions and sampled palette persist with the submission')
  assert(Boolean(accessibility && accessibility.issues.some((issue) => issue.category === 'READABILITY')), 'accessibility review checks reading ease on image submissions')
  const visualDetail = await api(`/submissions/${visualBody.id}`)
  assert(visualDetail.status === 200 && visualDetail.body.includes('Visual review') && visualDetail.body.includes('Accessibility check'), 'visual and accessibility results render on the review page')

  const feedback = await api('/api/feedback', {
    method: 'POST', body: JSON.stringify({ submissionId: visualBody.id, helpfulness: 5, category: 'VISUAL_REVIEW', comment: 'The palette evidence is easy to understand.' }),
  })
  assert(feedback.status === 201, 'reviewer can submit structured product feedback')

  const repeatTermDraft = 'Cheap options are cheap for every team. Our cheap plan keeps the message cheap and clear. Avoid cheap promises.'
  const repeatSubmission = await api('/api/submissions', {
    method: 'POST', body: JSON.stringify({ title: 'Repeated wording insight check', channel: 'Blog post', purpose: 'Create repeated decisions for guideline insights.', content: repeatTermDraft }),
  })
  const repeatFindings = repeatSubmission.body.id ? await db.finding.findMany({ where: { submissionId: repeatSubmission.body.id, sourceCode: 'T-001' } }) : []
  assert(repeatFindings.length >= 5, 'repeat-use sample produces five decisions on one guidance source')
  for (let index = 0; index < Math.min(5, repeatFindings.length); index += 1) {
    await api(`/api/findings/${repeatFindings[index].id}/decision`, { method: 'POST', body: JSON.stringify({ action: 'DISMISS', note: `Context ${index + 1} needs a clearer explanation.` }) })
  }

  await login('admin@truemark.test')
  const insights = await api('/api/admin/insights')
  assert(insights.status === 200 && insights.body.insights.some((item) => item.sourceCode === 'T-001'), 'repeated dismissals surface a clarification signal for the Admin')
  await login('superadmin@truemark.test')
  const feedbackList = await api('/api/superadmin/feedback')
  assert(feedbackList.status === 200 && feedbackList.body.feedback.some((item) => item.category === 'VISUAL_REVIEW'), 'Super Admin can review structured tester feedback')
  await login('admin@truemark.test')
  const confirm = await api('/api/admin/library/import/confirm', {
    method: 'POST',
    body: JSON.stringify({
      rules: [{ title: 'Imported naming rule', text: 'Always spell the brand name TrueMark as one word in imported documents.' }],
      facts: [{ statement: 'The workspace supports guideline imports from DOCX and PDF files.', source: 'Smoke test source' }],
      terms: [{ value: 'viral', status: 'BANNED', replacement: 'high-reach', reason: 'Undermines precise claims.' }],
    }),
  })
  assert(confirm.status === 201, 'library import confirm creates items (201)')
  assert(confirm.body.rules === 1 && confirm.body.facts === 1 && confirm.body.terms === 1, 'import counts reported')
  const importedRule = await db.rule.findFirst({ where: { code: 'R-009' } })
  const importedFact = await db.fact.findFirst({ where: { code: 'F-006' } })
  const importedTerm = await db.term.findFirst({ where: { code: 'T-007' } })
  assert(importedRule && importedRule.approved === false, 'imported rule R-009 saved as draft')
  assert(importedFact && importedFact.approved === false, 'imported fact F-006 saved as draft')
  assert(importedTerm && importedTerm.approved === false, 'imported term T-007 saved as draft')

  // 11. The audit trail recorded the workflow and provider calls.
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

  const aiLogs = await db.aiCallLog.count({ where: { submissionId: { in: [submissionId, second.body.id] } } })
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
