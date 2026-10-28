import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseJsonBody, withAuth, writeAudit } from '@/lib/api'
import { submissionSchema } from '@/lib/validation'
import type { FindingDraft } from '@/lib/review/types'
import { checkTerms } from '@/lib/review/deterministic'
import { auditAccessibility } from '@/lib/review/accessibility'
import sharp from 'sharp'
import { ACCEPTED_IMAGE_TYPES, MAX_BRAND_IMAGE_BYTES } from '@backend/review/visual'
import { deletePrivateAsset, newCreativeKey, storePrivateAsset } from '@/lib/files/private-assets'
import { workspaceIdOrError } from '@/lib/workspace'

export const maxDuration = 30

async function submissionInput(req: NextRequest) {
  if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
    const parsed = await parseJsonBody(req, submissionSchema)
    return parsed.ok
      ? { ok: true as const, data: parsed.data, image: null, altText: null }
      : { ok: false as const, response: parsed.response }
  }

  let form: FormData
  try { form = await req.formData() } catch {
    return { ok: false as const, response: NextResponse.json({ error: 'Send a valid multipart form.' }, { status: 400 }) }
  }
  const raw = {
    title: form.get('title'), channel: form.get('channel'),
    purpose: form.get('purpose'), content: form.get('content'),
    confidentialSpans: (() => { try { return JSON.parse(String(form.get('confidentialSpans') ?? '[]')) } catch { return null } })(),
  }
  const parsed = submissionSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, response: NextResponse.json({ error: 'Invalid submission.', issues: parsed.error.flatten().fieldErrors }, { status: 422 }) }
  }
  const altTextValue = String(form.get('imageAltText') ?? '').trim()
  if (altTextValue.length > 500) {
    return { ok: false as const, response: NextResponse.json({ error: 'Image alt text must be 500 characters or fewer.' }, { status: 422 }) }
  }
  const uploaded = form.get('image')
  let image: { buffer: Buffer; mimeType: string; fileName: string } | null = null
  if (uploaded instanceof File && uploaded.size > 0) {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(uploaded.type)) {
      return { ok: false as const, response: NextResponse.json({ error: 'Creative image must be PNG, JPEG or WebP.' }, { status: 415 }) }
    }
    if (uploaded.size > MAX_BRAND_IMAGE_BYTES) {
      return { ok: false as const, response: NextResponse.json({ error: 'Creative images must be 3 MB or smaller.' }, { status: 413 }) }
    }
    image = { buffer: Buffer.from(await uploaded.arrayBuffer()), mimeType: uploaded.type, fileName: uploaded.name.slice(0, 180) }
  }
  return { ok: true as const, data: parsed.data, image, altText: image ? altTextValue : null }
}

function toFindingRows(submissionId: string, drafts: FindingDraft[]) {
  return drafts.map((draft) => ({
    submissionId,
    reviewedVersion: 1,
    sourceType: draft.sourceType,
    ruleId: draft.sourceType === 'RULE' ? draft.sourceId : null,
    factId: draft.sourceType === 'FACT' ? draft.sourceId : null,
    termId: draft.sourceType === 'TERM' ? draft.sourceId : null,
    sourceCode: draft.sourceCode,
    quotedSpan: draft.quotedSpan,
    spanStart: draft.spanStart,
    spanEnd: draft.spanEnd,
    explanation: draft.explanation,
    suggestedFix: draft.suggestedFix ?? null,
    severity: draft.severity,
    confidence: draft.confidence,
    origin: draft.origin,
  }))
}

export const POST = withAuth(['ADMIN', 'MANAGER', 'CREATOR'], async (req: NextRequest, session) => {
  const workspaceId = workspaceIdOrError(session)
  if (workspaceId instanceof NextResponse) return workspaceId
  const parsed = await submissionInput(req)
  if (!parsed.ok) return parsed.response
  const { title, channel, purpose, content } = parsed.data

  let imageAsset: { key: string; buffer: Buffer } | null = null
  if (parsed.image) {
    try {
      const metadata = await sharp(parsed.image.buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata()
      if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
        return NextResponse.json({ error: 'Upload a valid, single-frame image.' }, { status: 422 })
      }
      const optimized = await sharp(parsed.image.buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer()
      const key = newCreativeKey()
      await storePrivateAsset(key, optimized, 'image/webp')
      imageAsset = { key, buffer: optimized }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not optimize this image.'
      return NextResponse.json({ error: `Could not process this image: ${message.slice(0, 160)}` }, { status: 422 })
    }
  }

  const accessibility = auditAccessibility(content, parsed.altText)
  const terms = await db.term.findMany({ where: { approved: true, workspaceId } })
  const immediateFindings = checkTerms(content, terms)

  let submission
  try {
    submission = await db.$transaction(async (tx) => {
      const created = await tx.submission.create({
        data: {
          title, channel, purpose, content, status: 'IN_REVIEW', reviewStatus: 'PENDING', creatorId: session.id, workspaceId,
          confidentialSpans: parsed.data.confidentialSpans?.length ? JSON.stringify(parsed.data.confidentialSpans) : null,
          imageStorageKey: imageAsset?.key ?? null,
          imageMimeType: imageAsset ? 'image/webp' : null,
          imageName: parsed.image?.fileName ?? null,
          imageByteSize: imageAsset?.buffer.byteLength ?? null,
          imageAltText: parsed.altText,
          accessibilityReview: JSON.stringify(accessibility),
        },
      })
      await tx.version.create({
        data: { submissionId: created.id, versionNumber: 1, content, createdById: session.id, note: 'Original submission.' },
      })
      for (const row of toFindingRows(created.id, immediateFindings)) await tx.finding.create({ data: row })
      await tx.reviewJob.create({ data: { submissionId: created.id, status: 'QUEUED' } })
      return created
    })
  } catch (error) {
    if (imageAsset) await deletePrivateAsset(imageAsset.key).catch(() => undefined)
    throw error
  }

  await writeAudit('SUBMISSION_CREATED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { title, channel, hasImage: Boolean(parsed.image), imageName: parsed.image?.fileName, immediateFindings: immediateFindings.length },
  })
  await writeAudit('REVIEW_QUEUED', 'Submission', {
    actorId: session.id,
    entityId: submission.id,
    metadata: { hasImage: Boolean(parsed.image) },
  })

  return NextResponse.json({ id: submission.id, findings: immediateFindings.length, reviewStatus: 'PENDING' }, { status: 201 })
})
