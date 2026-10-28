import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth, writeAudit } from '@/lib/api'
import { db } from '@/lib/db'
import { getBrandProfile } from '@/lib/brand-profile'
import { ACCEPTED_IMAGE_TYPES, MAX_BRAND_IMAGE_BYTES } from '@backend/review/visual'
import { workspaceIdOrError } from '@/lib/workspace'

const hexColor = /^#[0-9A-Fa-f]{6}$/

export const GET = withAuth(['ADMIN'], async (_req, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const profile = await getBrandProfile(workspaceId)
  return NextResponse.json({
    profile: {
      name: profile.name,
      palette: profile.palette,
      logoFileName: profile.logoFileName,
      logoPreview: profile.logoData && profile.logoMimeType
        ? `data:${profile.logoMimeType};base64,${profile.logoData}`
        : null,
    },
  })
})

export const PUT = withAuth(['ADMIN'], async (req: NextRequest, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  let form: FormData
  try { form = await req.formData() } catch {
    return NextResponse.json({ error: 'Send brand settings as multipart form data.' }, { status: 400 })
  }

  const paletteResult = z.array(z.string().regex(hexColor)).min(1).max(8).safeParse(
    (() => { try { return JSON.parse(String(form.get('palette') ?? '[]')) } catch { return null } })(),
  )
  if (!paletteResult.success) {
    return NextResponse.json({ error: 'Add 1–8 valid hex colors, such as #6D4AFF.' }, { status: 422 })
  }
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Brand name must be between 2 and 80 characters.' }, { status: 422 })
  }

  const previous = await getBrandProfile(workspaceId)
  const logo = form.get('logo')
  let logoData = previous.logoData
  let logoMimeType = previous.logoMimeType
  let logoFileName = previous.logoFileName
  if (form.get('removeLogo') === 'true') {
    logoData = null
    logoMimeType = null
    logoFileName = null
  }
  if (logo instanceof File && logo.size > 0) {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(logo.type)) {
      return NextResponse.json({ error: 'Logo reference must be PNG, JPEG or WebP.' }, { status: 415 })
    }
    if (logo.size > MAX_BRAND_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Logo files must be 3 MB or smaller.' }, { status: 413 })
    }
    const buffer = Buffer.from(await logo.arrayBuffer())
    try {
      const sharp = (await import('sharp')).default
      const metadata = await sharp(buffer, { failOn: 'error', limitInputPixels: 20_000_000 }).metadata()
      if (!metadata.width || !metadata.height || metadata.pages && metadata.pages > 1) throw new Error('Invalid logo image.')
    } catch {
      return NextResponse.json({ error: 'The logo file is not a readable image.' }, { status: 422 })
    }
    logoData = buffer.toString('base64')
    logoMimeType = logo.type
    logoFileName = logo.name.slice(0, 180)
  }

  const profile = await db.brandProfile.upsert({
    where: { workspaceId },
    create: {
      workspaceId, name, palette: JSON.stringify(paletteResult.data),
      logoData, logoMimeType, logoFileName,
    },
    update: { name, palette: JSON.stringify(paletteResult.data), logoData, logoMimeType, logoFileName },
  })
  await writeAudit('BRAND_PROFILE_UPDATED', 'BrandProfile', {
    actorId: session.id,
    entityId: profile.id,
    metadata: { paletteColors: paletteResult.data.length, hasLogo: Boolean(logoData) },
  })
  return NextResponse.json({ ok: true, logoFileName: profile.logoFileName })
})
