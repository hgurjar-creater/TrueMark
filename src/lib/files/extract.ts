import mammoth from 'mammoth'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export type ExtractedKind = 'docx' | 'pdf' | 'text'

export interface ExtractionResult {
  kind: ExtractedKind
  fileName: string
  text: string
  characters: number
}

export class UploadError extends Error {
  status: number

  constructor(message: string, status = 415) {
    super(message)
    this.status = status
  }
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
}

// Extracts editable text from uploaded documents. Creative images use the
// separate visual-review submission path rather than document text extraction.
export async function extractText(fileName: string, buffer: Buffer): Promise<ExtractionResult> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError('Files must be 5 MB or smaller.', 413)
  }
  if (buffer.byteLength === 0) {
    throw new UploadError('The uploaded file is empty.', 400)
  }

  const ext = extensionOf(fileName)
  let text: string
  let kind: ExtractedKind

  if (ext === 'docx') {
    kind = 'docx'
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  } else if (ext === 'pdf') {
    kind = 'pdf'
    // Load PDF.js only for PDFs. Its Node build needs the canvas globals that
    // pdf-parse otherwise tries to discover through an optional dynamic require.
    // Explicitly importing the native adapter also makes Vercel include it in
    // the function trace; TXT and DOCX uploads never load this dependency.
    const canvas = await import('@napi-rs/canvas')
    const globals = globalThis as unknown as Record<string, unknown>
    globals.DOMMatrix ??= canvas.DOMMatrix
    globals.ImageData ??= canvas.ImageData
    globals.Path2D ??= canvas.Path2D
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    try {
      const parsed = await parser.getText()
      text = parsed.text
    } finally {
      await parser.destroy()
    }
  } else if (ext === 'txt' || ext === 'md') {
    kind = 'text'
    text = buffer.toString('utf8')
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    throw new UploadError(
      'Use the Visual brand check field to attach a PNG, JPEG or WebP creative. This field reads DOCX, PDF, TXT or MD text.',
    )
  } else {
    throw new UploadError('Unsupported file type. Upload DOCX, PDF, TXT or MD.')
  }

  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (cleaned.length < 20) {
    throw new UploadError('No readable text found in this file. Scanned PDFs without a text layer are not supported yet.')
  }
  return { kind, fileName, text: cleaned, characters: cleaned.length }
}
