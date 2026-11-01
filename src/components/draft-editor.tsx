'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Direct draft editing for the submission's Creator and for Managers/Admins.
// Saves as a new version so the comparison history records every change.
export function DraftEditor({
  submissionId,
  initialContent,
}: {
  submissionId: string
  initialContent: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not save the edit.')
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setContent(initialContent) }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Edit draft text
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={8}
            maxLength={20000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={pending || content.trim() === initialContent.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save as new version'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
