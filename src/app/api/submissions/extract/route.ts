import { NextResponse, type NextRequest } from 'next/server'
import { withAuth, writeAudit } from '@/lib/api'
import { UploadError, extractText } from '@/lib/files/extract'

// Draft files never go to the model as-is: the text is extracted first, shown
// to the creator, and only the pasted/edited text is reviewed.
export const POST = withAuth(null, async (req: NextRequest, session) => {
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
    const result = await extractText(file.name, buffer)
    await writeAudit('DRAFT_FILE_EXTRACTED', 'Submission', {
      actorId: session.id,
      metadata: { fileName: result.fileName, kind: result.kind, characters: result.characters },
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[extract] File extraction failed:', error)
    return NextResponse.json({ error: 'Could not read text from this file.' }, { status: 500 })
  }
})
