'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ApprovalActions({
  submissionId,
  disabled,
}: {
  submissionId: string
  disabled: boolean
}) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'none' | 'approve' | 'request'>('none')

  async function act(action: 'APPROVE' | 'REQUEST_CHANGES') {
    setPending(action === 'APPROVE' ? 'approve' : 'request')
    setError(null)
    try {
      const res = await fetch(`/api/submissions/${submissionId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: comment.trim().length > 0 ? comment.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Unable to record the decision.')
        return
      }
      setComment('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending('none')
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={2}
        maxLength={2000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment recorded with your decision…"
        disabled={disabled}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act('APPROVE')}
          disabled={disabled || pending !== 'none'}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {pending === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={() => act('REQUEST_CHANGES')}
          disabled={disabled || pending !== 'none'}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
        >
          {pending === 'request' ? 'Recording…' : 'Request changes'}
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Approving marks the content ready for publication with its full review record.
      </p>
    </div>
  )
}
