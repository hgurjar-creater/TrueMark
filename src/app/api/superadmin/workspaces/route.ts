import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, writeAudit } from '@/lib/api'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const createSchema = z.object({
  brandName: z.string().trim().min(2).max(80),
  adminName: z.string().trim().min(2).max(80),
  adminEmail: z.string().trim().toLowerCase().email().max(160),
  temporaryPassword: z.string().min(12).max(72),
})

export const GET = withAuth(['SUPER_ADMIN'], async () => {
  const workspaces = await db.workspace.findMany({
    orderBy: { createdAt: 'desc' },
    include: { users: { where: { role: 'ADMIN' }, select: { id: true, name: true, email: true, createdAt: true } }, _count: { select: { users: true, submissions: true } } },
  })
  return NextResponse.json({ workspaces })
})

export const POST = withAuth(['SUPER_ADMIN'], async (req: NextRequest, session) => {
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Enter a brand name, Admin name, valid email, and a temporary password of at least 12 characters.', issues: parsed.error.flatten().fieldErrors }, { status: 422 })
  if (await db.user.findUnique({ where: { email: parsed.data.adminEmail }, select: { id: true } })) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await hashPassword(parsed.data.temporaryPassword)
  const workspace = await db.$transaction(async (tx) => {
    const brand = await tx.workspace.create({ data: { name: parsed.data.brandName } })
    await tx.user.create({ data: { name: parsed.data.adminName, email: parsed.data.adminEmail, passwordHash, role: 'ADMIN', workspaceId: brand.id } })
    await tx.brandProfile.create({ data: { workspaceId: brand.id, name: brand.name, palette: JSON.stringify(['#6D4AFF', '#211D2D', '#FFFFFF']) } })
    return brand
  })
  await writeAudit('BRAND_WORKSPACE_CREATED', 'Workspace', { actorId: session.id, entityId: workspace.id, metadata: { brandName: workspace.name, adminEmail: parsed.data.adminEmail } })
  return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name, adminEmail: parsed.data.adminEmail } }, { status: 201 })
})
