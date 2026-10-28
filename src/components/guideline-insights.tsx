'use client'

import { useState } from 'react'
import type { GuidelineInsightView } from '@/lib/review/insights'

export function GuidelineInsights({ initial }: { initial: GuidelineInsightView[] }) {
  const [insights, setInsights] = useState(initial)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function save(item: GuidelineInsightView, status: 'DRAFT' | 'REVIEWED') {
    setBusyKey(item.sourceKey)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKey: item.sourceKey, clarificationDraft: item.clarificationDraft, status }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Could not save this clarification.')
      setInsights((current) => current.map((value) => value.sourceKey === item.sourceKey ? { ...value, status } : value))
      setNotice(`${item.sourceCode} clarification ${status === 'REVIEWED' ? 'marked reviewed' : 'saved as a draft'}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this clarification.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Guideline intelligence</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Where guidance needs clarity</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">A source appears after at least five recorded decisions and a 40% dismissal rate. These are review signals, not automatic rule changes.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{insights.length} signal{insights.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>}
      {insights.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">No repeat-dismissal signal yet</p>
          <p className="mt-1 max-w-2xl text-xs leading-5">TrueMark waits for five decisions on the same approved source and at least 40% dismissals before suggesting a clarification. That keeps one-off disagreements from changing the guidelines.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {insights.map((item) => (
            <article key={item.sourceKey} className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">{item.sourceCode} · {item.sourceType}</p><h3 className="mt-1 text-sm font-semibold text-slate-900">{item.sourceTitle}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{item.sourceText}</p></div>
                <div className="rounded-xl bg-white px-3 py-2 text-right"><p className="text-lg font-bold text-amber-800">{item.dismissalRate}%</p><p className="text-[9px] uppercase tracking-wide text-slate-500">dismissed · {item.decisionCount} decisions</p></div>
              </div>
              {item.sampleNotes.length > 0 && <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs leading-5 text-slate-600"><span className="font-semibold">Feedback patterns:</span> {item.sampleNotes.map((note) => `“${note}”`).join(' · ')}</p>}
              <label className="mt-4 block text-xs font-semibold text-slate-700">Clarification draft for Admin review<textarea value={item.clarificationDraft} onChange={(event) => setInsights((current) => current.map((value) => value.sourceKey === item.sourceKey ? { ...value, clarificationDraft: event.target.value, status: 'DRAFT' } : value))} rows={5} maxLength={4000} className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs leading-5 font-normal text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" /></label>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => void save(item, 'DRAFT')} disabled={busyKey === item.sourceKey} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60">{busyKey === item.sourceKey ? 'Saving…' : 'Save draft'}</button>
                <button onClick={() => void save(item, 'REVIEWED')} disabled={busyKey === item.sourceKey} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-60">Mark reviewed</button>
                <span className="text-[10px] text-slate-500">{item.status === 'REVIEWED' ? 'Reviewed by an Admin' : 'Draft · does not replace the approved rule'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
