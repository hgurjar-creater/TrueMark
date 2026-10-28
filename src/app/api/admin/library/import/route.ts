import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, writeAudit } from '@/lib/api'
import { UploadError, extractText } from '@/lib/files/extract'
import { extractLibraryCandidates } from '@backend/library/extract'

// Step 1 of the import: extract candidates from an uploaded guideline file and
// return them for preview. Nothing is saved until the admin confirms.
export const POST = withAuth(['ADMIN'], async (req: NextRequest, session) => {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Send the file as multipart form data.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach a file field named "file".' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractText(file.name, buffer)
    const { candidates, provider } = await extractLibraryCandidates(extracted.text, extracted.fileName)
    const total = candidates.rules.length + candidates.facts.length + candidates.terms.length

    await writeAudit('LIBRARY_IMPORT_PREVIEWED', 'Library', {
      actorId: session.id,
      metadata: { fileName: extracted.fileName, provider, items: total },
    })

    return NextResponse.json({ fileName: extracted.fileName, provider, characters: extracted.characters, candidates })
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[library-import] Preview failed:', error)
    return NextResponse.json({ error: 'Could not extract library items from this file.' }, { status: 500 })
  }
})
