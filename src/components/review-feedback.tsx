'use client'

import { useState, type FormEvent } from 'react'

export function ReviewFeedback({ submissionId }: { submissionId: string }) {
  const [helpfulness, setHelpfulness] = useState(4)
  const [category, setCategory] = useState('TEXT_REVIEW')
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, helpfulness, category, comment }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Feedback could not be sent.')
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feedback could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-sky-700">Help us improve</p><h2 className="mt-1 text-base font-semibold text-slate-900">Was this review useful?</h2></div><span aria-hidden="true" className="text-2xl">✳</span></div>
      {sent ? <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Thanks. Your structured feedback is saved for the product team.</p> : (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Helpfulness rating">
            {[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-pressed={helpfulness === value} onClick={() => setHelpfulness(value)} className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition ${helpfulness === value ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50'}`} aria-label={`${value} out of 5`}>{value}</button>)}
            <span className="ml-2 text-xs text-slate-500">1 = not useful · 5 = very useful</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs"><option value="TEXT_REVIEW">Text review</option><option value="VISUAL_REVIEW">Visual brand check</option><option value="ACCESSIBILITY">Accessibility</option><option value="WORKFLOW">Workflow</option></select>
            <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder="Optional: what should be clearer?" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
          </div>
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          <button disabled={busy} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{busy ? 'Sending…' : 'Send feedback'}</button>
        </form>
      )}
    </section>
  )
}
