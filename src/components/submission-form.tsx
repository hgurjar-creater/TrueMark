'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CHANNELS } from '@/lib/validation'

export function SubmissionForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<string>(CHANNELS[0])
  const [purpose, setPurpose] = useState('')
  const [content, setContent] = useState('')
  const [confidentialSpans, setConfidentialSpans] = useState<Array<{ start: number; end: number }>>([])
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imageAltText, setImageAltText] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [extracting, setExtracting] = useState(false)

  useEffect(() => {
    if (!image) { setImagePreview(null); return }
    const url = URL.createObjectURL(image)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setExtracting(true)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/submissions/extract', { method: 'POST', body: form })
      const data = (await res.json()) as { text?: string; fileName?: string; error?: string }
      if (!res.ok || !data.text) {
        setError(data.error ?? 'Could not read the file.')
        return
      }
      setContent(data.text)
      setNotice(`Loaded "${data.fileName}". Check the extracted text below — you can edit it before submitting.`)
    } catch {
      setError('Network error while uploading the file.')
    } finally {
      setExtracting(false)
      event.target.value = ''
    }
  }

  async function loadDemoCreative() {
    setError(null)
    try {
      const response = await fetch('/demo-creative.png')
      if (!response.ok) throw new Error('The sample creative could not be loaded.')
      const blob = await response.blob()
      setImage(new File([blob], 'truemark-demo-creative.png', { type: 'image/png' }))
      setImageAltText('A square campaign card with a red “True Mark” logo, warm orange and pink colors, and a guaranteed-results claim.')
      setNotice('Demo creative loaded. It contains deliberate logo, palette and claim issues for the visual review to inspect.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sample creative could not be loaded.')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const payload = image
        ? (() => {
            const form = new FormData()
            form.set('title', title)
            form.set('channel', channel)
            form.set('purpose', purpose)
            form.set('content', content)
            form.set('confidentialSpans', JSON.stringify(confidentialSpans))
            form.set('image', image)
            form.set('imageAltText', imageAltText)
            return form
          })()
        : JSON.stringify({ title, channel, purpose, content, confidentialSpans })
      const res = await fetch('/api/submissions', {
        method: 'POST',
        ...(typeof payload === 'string' ? { headers: { 'Content-Type': 'application/json' } } : {}),
        body: payload,
      })
      const data = (await res.json()) as { id?: string; error?: string; issues?: Record<string, string[]> }
      if (!res.ok || !data.id) {
        const firstIssue = data.issues ? Object.values(data.issues).flat()[0] : undefined
        setError(firstIssue ?? data.error ?? 'Unable to create the submission.')
        return
      }
      router.push(`/submissions/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  function markSelectionConfidential() {
    const field = contentRef.current
    if (!field || field.selectionStart === field.selectionEnd) {
      setNotice('Select a passage in the draft first, then mark it confidential.')
      return
    }
    const start = field.selectionStart
    const end = field.selectionEnd
    if (confidentialSpans.some((span) => start < span.end && end > span.start)) {
      setNotice('That selection overlaps a passage already marked confidential.')
      return
    }
    setConfidentialSpans((current) => [...current, { start, end }].sort((a, b) => a.start - b.start))
    setNotice('Passage marked confidential. It stays in your private review record and will be masked before external text-AI review.')
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          minLength={3}
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Launch post for our free tier"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="channel" className="block text-sm font-medium text-slate-700">
          Channel
        </label>
        <select
          id="channel"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className={inputClass}
        >
          {CHANNELS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="purpose" className="block text-sm font-medium text-slate-700">
          Purpose of the piece
        </label>
        <textarea
          id="purpose"
          required
          rows={2}
          minLength={3}
          maxLength={500}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="What should this piece achieve, and for whom?"
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="content" className="block text-sm font-medium text-slate-700">
            Draft
          </label>
          <label
            htmlFor="draft-file"
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {extracting ? 'Reading file…' : 'Upload file (DOCX, PDF, TXT)'}
          </label>
          <input
            id="draft-file"
            type="file"
            accept=".docx,.pdf,.txt,.md"
            onChange={handleFile}
            disabled={extracting}
            className="hidden"
          />
        </div>
        <textarea
          ref={contentRef}
          id="content"
          required
          rows={10}
          minLength={20}
          maxLength={20000}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (confidentialSpans.length) {
              setConfidentialSpans([])
              setNotice('Draft changed, so confidential selections were cleared. Re-select any passages before submitting.')
            }
          }}
          placeholder="Paste the text you want reviewed, or upload a Word, PDF or text file above."
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <p className="mt-1 text-xs text-slate-400">
          Text findings cite approved rules, facts and terms. Nothing is rewritten automatically.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={markSelectionConfidential} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">Mark selected text confidential</button>
          <span className="text-[10px] text-slate-500">Marked passages are replaced with blocks before any external text-AI call; local checks and your private review record keep the original.</span>
        </div>
        {confidentialSpans.length > 0 && <ul className="mt-2 space-y-1">{confidentialSpans.map((span, index) => <li key={`${span.start}-${span.end}`} className="flex items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs"><span className="truncate text-amber-950">Private passage {index + 1}: “{content.slice(span.start, span.end).slice(0, 90)}{span.end - span.start > 90 ? '…' : ''}”</span><button type="button" onClick={() => setConfidentialSpans((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 font-semibold text-rose-700 hover:underline">Remove</button></li>)}</ul>}
      </div>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-700">Visual brand check</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Add the creative to check its visual identity</h3>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">We compare colors, logo use, proportions and contrast with your Admin’s approved references. Image text still needs your alt description. When Gemini is configured, the creative and approved logo reference are sent to Google for visual review.</p>
          </div>
          <label htmlFor="creative-image" className="cursor-pointer rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-800 shadow-sm hover:bg-violet-50">
            {image ? 'Replace image' : 'Choose image'}
          </label>
          {!image && <button type="button" onClick={() => void loadDemoCreative()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Try demo creative</button>}
          <input id="creative-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} className="sr-only" />
        </div>
        {image && imagePreview && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src={imagePreview} alt="Selected creative preview" className="max-h-48 w-full object-contain" />
              <div className="truncate border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">{image.name} · {(image.size / (1024 * 1024)).toFixed(2)} MB</div>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Alternative text <span className="font-normal text-slate-400">(recommended, 500 characters max)</span>
              <textarea value={imageAltText} onChange={(event) => setImageAltText(event.target.value)} rows={4} maxLength={500} placeholder="Describe the useful information in the visual for someone who cannot see it." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
              <span className="mt-1 block text-xs font-normal text-slate-400">PNG, JPEG or WebP · up to 3 MB. Image and review are stored with this submission.</span>
            </label>
          </div>
        )}
      </section>

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Reviewing draft…' : 'Submit for review'}
      </button>
    </form>
  )
}
