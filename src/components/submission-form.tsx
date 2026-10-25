'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CHANNELS } from '@/lib/validation'

export function SubmissionForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [channel, setChannel] = useState<string>(CHANNELS[0])
  const [purpose, setPurpose] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, channel, purpose, content }),
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
        <label htmlFor="content" className="block text-sm font-medium text-slate-700">
          Draft
        </label>
        <textarea
          id="content"
          required
          rows={10}
          minLength={20}
          maxLength={20000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste the text you want reviewed before publication."
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          The review checks this text against approved rules, facts and terms only. Nothing is
          rewritten automatically.
        </p>
      </div>

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
