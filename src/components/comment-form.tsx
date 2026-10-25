'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CommentForm({ submissionId }: { submissionId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Unable to post the comment.')
        return
      }
      setBody('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <textarea
        rows={2}
        maxLength={2000}
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment for the team…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || body.trim().length === 0}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  )
}
