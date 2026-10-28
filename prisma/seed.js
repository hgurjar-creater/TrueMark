// TrueMark demo seed. Idempotent: safe to run repeatedly.
// Usage: node prisma/seed.js  (or npm run db:seed)

const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')
const sharp = require('sharp')

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'truemark1234'
const isProduction = process.env.NODE_ENV === 'production'

// On an empty deployment, the first sign-up becomes Super Admin. Local demos
// Local demos include a Super Admin and sample Manager/Creator accounts. A
// demo brand Admin is added only when that workspace has no Admin already.
const demoUsers = [
  { email: 'superadmin@truemark.test', name: 'TrueMark Super Admin', role: 'SUPER_ADMIN', password: DEMO_PASSWORD },
  { email: 'manager@truemark.test', name: 'Mohan Manager', role: 'MANAGER', password: DEMO_PASSWORD },
  { email: 'creator@truemark.test', name: 'Chhaya Creator', role: 'CREATOR', password: DEMO_PASSWORD },
]

const rules = [
  {
    code: 'R-001',
    title: 'Write TrueMark as one word',
    text: 'The product name is always written as "TrueMark" with a capital T and M, never "Truemark" or "True Mark".',
    category: 'Naming',
  },
  {
    code: 'R-002',
    title: 'Verifiable claims only',
    text: 'Promotional claims must be supported by an approved fact. Superlatives such as "best" or "leading" require a cited source.',
    category: 'Claims',
  },
  {
    code: 'R-003',
    title: 'No guaranteed outcomes',
    text: 'Do not promise guaranteed results. Use "designed to" instead of "guarantees" when describing product behaviour.',
    category: 'Claims',
  },
  {
    code: 'R-004',
    title: 'Cite every statistic',
    text: 'Every number or statistic in published content must cite an approved fact by its code.',
    category: 'Claims',
  },
  {
    code: 'R-005',
    title: 'Friendly plain language',
    text: 'Write in short, plain sentences a first-time reader understands. Avoid unexplained jargon.',
    category: 'Tone',
  },
  {
    code: 'R-006',
    title: 'No false urgency',
    text: 'Avoid manufactured urgency such as "last chance", "act now" or countdown pressure unless the offer genuinely ends.',
    category: 'Tone',
  },
  {
    code: 'R-007',
    title: 'Headline length',
    text: 'Headlines must not exceed 12 words.',
    category: 'Structure',
  },
  {
    code: 'R-008',
    title: 'Feature-level comparisons',
    text: 'Do not name competitors directly. Compare at the feature level instead.',
    category: 'Legal',
  },
]

const facts = [
  {
    code: 'F-001',
    statement: 'TrueMark reviewed drafts for 12 pilot organisations during the 2026 pilot programme.',
    source: 'Pilot programme report, 2026',
  },
  {
    code: 'F-002',
    statement: 'The free tier allows 50 reviews per month.',
    source: 'Pricing page v3',
  },
  {
    code: 'F-003',
    statement: 'TrueMark currently supports English drafts; Hindi support is planned.',
    source: 'Product spec 2.1',
  },
  {
    code: 'F-004',
    statement: 'TrueMark was founded in 2026 by two university students in India.',
    source: 'About page',
  },
  {
    code: 'F-005',
    statement: 'A SOC 2 Type I audit is scheduled for Q1 2027 and has not been completed.',
    source: 'Compliance tracker',
    expiresAt: new Date('2027-04-01'),
  },
]

const terms = [
  {
    code: 'T-001',
    value: 'cheap',
    status: 'BANNED',
    replacement: 'cost-effective',
    reason: 'Undermines premium positioning.',
  },
  {
    code: 'T-002',
    value: 'guaranteed',
    status: 'BANNED',
    replacement: 'designed to',
    reason: 'Unverifiable promise; conflicts with rule R-003.',
  },
  {
    code: 'T-003',
    value: 'revolutionary',
    status: 'BANNED',
    replacement: 'new',
    reason: 'Superlative without evidence; conflicts with rule R-002.',
  },
  {
    code: 'T-004',
    value: 'AI-powered',
    status: 'BANNED',
    replacement: 'AI-assisted',
    reason: 'Human-control promise: AI assists, people decide.',
  },
  {
    code: 'T-005',
    value: 'team members',
    status: 'PREFERRED',
    replacement: null,
    reason: 'Preferred over "manpower".',
  },
  {
    code: 'T-006',
    value: 'before publication',
    status: 'PREFERRED',
    replacement: null,
    reason: 'Precise about when checks run.',
  },
]

async function main() {
  const demoWorkspace = await prisma.workspace.upsert({
    where: { id: 'truemark-demo' }, update: { name: 'TrueMark Demo' },
    create: { id: 'truemark-demo', name: 'TrueMark Demo' },
  })
  await prisma.user.updateMany({ where: { workspaceId: null, role: { not: 'SUPER_ADMIN' } }, data: { workspaceId: demoWorkspace.id } })

  const users = isProduction ? [] : [...demoUsers]
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN', workspaceId: demoWorkspace.id, email: { not: 'admin@truemark.test' } } })
  const demoAdmin = await prisma.user.findUnique({ where: { email: 'admin@truemark.test' } })
  if (existingAdmin && demoAdmin && existingAdmin.id !== demoAdmin.id && demoAdmin.workspaceId === demoWorkspace.id) {
    const usage = await prisma.user.findUnique({ where: { id: demoAdmin.id }, include: { _count: { select: { submissions: true, versions: true, comments: true, findings: true, feedback: true } } } })
    const hasProductData = usage && Object.values(usage._count).some((count) => count > 0)
    if (hasProductData) throw new Error('The extra demo Admin has product data. Reassign it before removing the fixture account.')
    await prisma.auditLog.updateMany({ where: { actorId: demoAdmin.id }, data: { actorId: null } })
    await prisma.user.delete({ where: { id: demoAdmin.id } })
  }
  if (!isProduction && !existingAdmin) {
    users.push({ email: 'admin@truemark.test', name: 'TrueMark Brand Admin', role: 'ADMIN', password: DEMO_PASSWORD })
  }

  for (const user of users) {
    const passwordHash = await hash(user.password, 12)
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, workspaceId: user.role === 'SUPER_ADMIN' ? null : demoWorkspace.id },
      create: { email: user.email, name: user.name, role: user.role, passwordHash, workspaceId: user.role === 'SUPER_ADMIN' ? null : demoWorkspace.id },
    })
  }
  await Promise.all([
    prisma.rule.updateMany({ where: { workspaceId: null }, data: { workspaceId: demoWorkspace.id } }),
    prisma.fact.updateMany({ where: { workspaceId: null }, data: { workspaceId: demoWorkspace.id } }),
    prisma.term.updateMany({ where: { workspaceId: null }, data: { workspaceId: demoWorkspace.id } }),
  ])

  for (const rule of rules) {
    await prisma.rule.upsert({
      where: { workspaceId_code: { workspaceId: demoWorkspace.id, code: rule.code } },
      update: {},
      create: { ...rule, approved: true, workspaceId: demoWorkspace.id },
    })
  }

  for (const fact of facts) {
    await prisma.fact.upsert({
      where: { workspaceId_code: { workspaceId: demoWorkspace.id, code: fact.code } },
      update: {},
      create: { ...fact, approved: true, workspaceId: demoWorkspace.id },
    })
  }

  for (const term of terms) {
    await prisma.term.upsert({
      where: { workspaceId_code: { workspaceId: demoWorkspace.id, code: term.code } },
      update: {},
      create: { ...term, approved: true, workspaceId: demoWorkspace.id },
    })
  }
  await Promise.all([
    prisma.submission.updateMany({ where: { workspaceId: null }, data: { workspaceId: demoWorkspace.id } }),
    prisma.productFeedback.updateMany({ where: { workspaceId: null }, data: { workspaceId: demoWorkspace.id } }),
  ])

  const demoLogoSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="560" height="160" viewBox="0 0 560 160"><rect width="160" height="160" rx="38" fill="#6D4AFF"/><path d="M45 83l24 24 49-55" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><text x="190" y="103" font-family="Arial,sans-serif" font-size="58" font-weight="700" fill="#211D2D">TrueMark</text></svg>')
  const demoLogoData = (await sharp(demoLogoSvg).png().toBuffer()).toString('base64')
  await prisma.brandProfile.upsert({
    where: { id: 'default' },
    update: { workspaceId: demoWorkspace.id },
    create: {
      id: 'default',
      workspaceId: demoWorkspace.id,
      name: 'TrueMark Demo',
      palette: JSON.stringify(['#6D4AFF', '#211D2D', '#FFFFFF']),
      logoData: demoLogoData,
      logoMimeType: 'image/png',
      logoFileName: 'truemark-demo-logo.png',
    },
  })
  const seededProfile = await prisma.brandProfile.findUnique({ where: { id: 'default' } })
  if (seededProfile && !seededProfile.logoData) {
    await prisma.brandProfile.update({
      where: { id: 'default' },
      data: { logoData: demoLogoData, logoMimeType: 'image/png', logoFileName: 'truemark-demo-logo.png' },
    })
  }

  console.log('Seed complete.')
  console.log(`Users: ${users.map((u) => `${u.email} (${u.role})`).join(', ')}`)
  if (!isProduction) console.log(`Local demo password: ${DEMO_PASSWORD}`)
  console.log(`Rules: ${rules.length}, facts: ${facts.length}, terms: ${terms.length}, all approved.`)
  console.log('Demo brand profile: violet, charcoal and white palette; set your logo in Admin → Brand references.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
