import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { withAuth, writeAudit } from '@/lib/api'
import { candidatesSchema } from '@backend/library/extract'
import { workspaceIdOrError } from '@/lib/workspace'

const confirmSchema = candidatesSchema

type Kind = 'R' | 'F' | 'T'

async function nextCodes(kind: Kind, count: number, workspaceId: string): Promise<string[]> {
  const existing =
    kind === 'R'
      ? await db.rule.findMany({ where: { workspaceId }, select: { code: true } })
      : kind === 'F'
        ? await db.fact.findMany({ where: { workspaceId }, select: { code: true } })
        : await db.term.findMany({ where: { workspaceId }, select: { code: true } })
  const max = existing.reduce((current, item) => {
    const match = new RegExp(`^${kind}-(\\d+)$`).exec(item.code)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return Array.from({ length: count }, (_, index) => `${kind}-${String(max + index + 1).padStart(3, '0')}`)
}

// Step 2 of the import: create the confirmed candidates as DRAFT items.
// They only become citable after the admin approves each one, so human
// approval stays in the loop even for imported guidelines.
export const POST = withAuth(['ADMIN'], async (req: NextRequest, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const parsedBody = await req.json().catch(() => null)
  const parsed = confirmSchema.safeParse(parsedBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid import data.', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }
  const { rules, facts, terms } = parsed.data
  const total = rules.length + facts.length + terms.length
  if (total === 0) {
    return NextResponse.json({ error: 'Nothing to import.' }, { status: 422 })
  }

  const created = await db.$transaction(async (tx) => {
    const ruleCodes = await nextCodes('R', rules.length, workspaceId)
    const factCodes = await nextCodes('F', facts.length, workspaceId)
    const termCodes = await nextCodes('T', terms.length, workspaceId)

    const importedRules = await Promise.all(
      rules.map((rule, index) =>
        tx.rule.create({
          data: {
            code: ruleCodes[index],
            title: rule.title,
            text: rule.text,
            category: rule.category ?? null,
            approved: false,
            workspaceId,
          },
          select: { code: true, title: true },
        }),
      ),
    )
    const importedFacts = await Promise.all(
      facts.map((fact, index) =>
        tx.fact.create({
          data: { code: factCodes[index], statement: fact.statement, source: fact.source, approved: false, workspaceId },
          select: { code: true, statement: true },
        }),
      ),
    )
    const importedTerms = await Promise.all(
      terms.map((term, index) =>
        tx.term.create({
          data: {
            code: termCodes[index],
            value: term.value,
            status: term.status,
            replacement: term.replacement ?? null,
            reason: term.reason,
            approved: false,
            workspaceId,
          },
          select: { code: true, value: true, status: true },
        }),
      ),
    )
    return { importedRules, importedFacts, importedTerms }
  })

  await writeAudit('LIBRARY_IMPORTED', 'Library', {
    actorId: session.id,
    metadata: {
      rules: created.importedRules.length,
      facts: created.importedFacts.length,
      terms: created.importedTerms.length,
      status: 'DRAFT',
    },
  })

  return NextResponse.json(
    {
      rules: created.importedRules.length,
      facts: created.importedFacts.length,
      terms: created.importedTerms.length,
      codes: {
        rules: created.importedRules.map((item) => item.code),
        facts: created.importedFacts.map((item) => item.code),
        terms: created.importedTerms.map((item) => item.code),
      },
    },
    { status: 201 },
  )
})
