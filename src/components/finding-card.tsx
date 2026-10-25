'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface FindingCardData {
  id: string
  reviewedVersion: number
  sourceType: string
  sourceCode: string
  sourceTitle: string
  sourceText: string
  quotedSpan: string
  explanation: string
  suggestedFix: string | null
  severity: string
  confidence: number
  status: string
  decisionNote: string | null
  decidedByName: string | null
  canDecide: boolean
}

const severityStyles: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-600',
}

const statusStyles: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  EDITED: 'bg-emerald-100 text-emerald-700',
  DISMISSED: 'bg-slate-100 text-slate-500',
}

export function FindingCard({ finding }: { finding: FindingCardData }) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'edit' | 'dismiss'>('none')
  const [replacement, setReplacement] = useState(finding.suggestedFix ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function decide(action: 'ACCEPT' | 'EDIT' | 'DISMISS') {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/findings/${finding.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          replacement: action === 'EDIT' ? replacement : undefined,
          note: action === 'DISMISS' ? note : undefined,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Unable to record the decision.')
        return
      }
      setMode('none')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  const needsJudgment = finding.confidence < 0.6

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
            severityStyles[finding.severity] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {finding.severity}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            statusStyles[finding.status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {finding.status.toLowerCase()}
        </span>
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-xs font-medium text-indigo-700">
          {finding.sourceCode}
        </span>
        <span className="text-xs text-slate-400">
          {Math.round(finding.confidence * 100)}% confidence
          {needsJudgment && ' · needs human judgment'} · checked against version{' '}
          {finding.reviewedVersion}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium text-slate-900">
        {finding.sourceTitle}{' '}
        <span className="text-xs font-normal uppercase tracking-wide text-slate-400">
          approved {finding.sourceType.toLowerCase()}
        </span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{finding.sourceText}</p>

      <blockquote className="mt-3 border-l-4 border-indigo-200 bg-indigo-50/50 px-3 py-2 text-sm italic text-slate-800">
        “{finding.quotedSpan}”
      </blockquote>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">{finding.explanation}</p>

      {finding.suggestedFix && finding.status === 'OPEN' && (
        <p className="mt-2 text-sm text-slate-600">
          Suggested change:{' '}
          <span className="font-medium text-slate-900">“{finding.suggestedFix}”</span>
        </p>
      )}

      {finding.status !== 'OPEN' && (
        <p className="mt-2 text-xs text-slate-500">
          {finding.status.toLowerCase()} by {finding.decidedByName ?? 'unknown'}
          {finding.decisionNote ? ` — “${finding.decisionNote}”` : ''}
        </p>
      )}

      {finding.canDecide && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {mode === 'none' && (
            <div className="flex flex-wrap gap-2">
              {finding.suggestedFix && (
                <button
                  type="button"
                  onClick={() => decide('ACCEPT')}
                  disabled={pending}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  Accept suggested change
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('edit')}
                disabled={pending}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Edit fix
              </button>
              <button
                type="button"
                onClick={() => setMode('dismiss')}
                disabled={pending}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
          )}

          {mode === 'edit' && (
            <div className="space-y-2">
              <label htmlFor={`replacement-${finding.id}`} className="block text-xs font-medium text-slate-600">
                Corrected text for the quoted span
              </label>
              <textarea
                id={`replacement-${finding.id}`}
                rows={2}
                maxLength={2000}
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => decide('EDIT')}
                  disabled={pending || replacement.trim().length === 0}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  Apply edit as new version
                </button>
                <button
                  type="button"
                  onClick={() => setMode('none')}
                  disabled={pending}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === 'dismiss' && (
            <div className="space-y-2">
              <label htmlFor={`note-${finding.id}`} className="block text-xs font-medium text-slate-600">
                Reason for dismissing (required)
              </label>
              <textarea
                id={`note-${finding.id}`}
                rows={2}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why does this finding not apply?"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => decide('DISMISS')}
                  disabled={pending || note.trim().length === 0}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-600 disabled:opacity-60"
                >
                  Dismiss with reason
                </button>
                <button
                  type="button"
                  onClick={() => setMode('none')}
                  disabled={pending}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
