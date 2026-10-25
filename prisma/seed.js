// TrueMark demo seed. Idempotent: safe to run repeatedly.
// Usage: node prisma/seed.js  (or npm run db:seed)

const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'truemark123'

const users = [
  { email: 'admin@truemark.test', name: 'Aarti Admin', role: 'ADMIN' },
  { email: 'manager@truemark.test', name: 'Mohan Manager', role: 'MANAGER' },
  { email: 'creator@truemark.test', name: 'Chhaya Creator', role: 'CREATOR' },
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
  const passwordHash = await hash(DEMO_PASSWORD, 12)

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, passwordHash },
    })
  }

  for (const rule of rules) {
    await prisma.rule.upsert({
      where: { code: rule.code },
      update: {},
      create: { ...rule, approved: true },
    })
  }

  for (const fact of facts) {
    await prisma.fact.upsert({
      where: { code: fact.code },
      update: {},
      create: { ...fact, approved: true },
    })
  }

  for (const term of terms) {
    await prisma.term.upsert({
      where: { code: term.code },
      update: {},
      create: { ...term, approved: true },
    })
  }

  console.log('Seed complete.')
  console.log(`Users: ${users.map((u) => `${u.email} (${u.role})`).join(', ')} — password: ${DEMO_PASSWORD}`)
  console.log(`Rules: ${rules.length}, facts: ${facts.length}, terms: ${terms.length}, all approved.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
