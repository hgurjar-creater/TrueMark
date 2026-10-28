'use client'

import { useState } from 'react'

interface EvaluationResult {
  casesRun: number
  labelledFindings: number
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number | null
  recall: number | null
  citationValidity: number
  modelCalls: number
  examples: Array<{ id: string; expected: string[]; actual: string[] }>
  note: string
}

function percent(value: number | null) { return value === null ? 'N/A' : `${Math.round(value * 100)}%` }

export function EvaluationPanel() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/evaluation', { method: 'POST' })
      const data = await response.json() as EvaluationResult & { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Evaluation could not run.')
      setResult(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Evaluation could not run.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-[#211d2d] to-[#39276b] p-5 text-white shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">Quality lab</p><h2 className="mt-1 text-lg font-semibold">Run the labelled review set</h2><p className="mt-1 max-w-xl text-sm leading-6 text-white/70">Compare source-code findings with four labelled examples. The run includes precision, recall and verifier citation validity.</p></div>
        <button type="button" onClick={() => void run()} disabled={busy} className="rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50 disabled:opacity-60">{busy ? 'Running checks…' : 'Run quality check'}</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-950/60 px-3 py-2 text-xs text-rose-100">{error}</p>}
      {result && <>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[['Precision', percent(result.precision)], ['Recall', percent(result.recall)], ['Valid citations', percent(result.citationValidity)]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-white/75">{result.casesRun} examples · {result.labelledFindings} labelled findings · {result.truePositives} true positives · {result.falsePositives} false positives · {result.falseNegatives} missed · {result.modelCalls} Gemini call(s)</p>
        <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <summary className="cursor-pointer text-xs font-semibold">See case-by-case results</summary>
          <ul className="mt-3 space-y-2">{result.examples.map((item) => <li key={item.id} className="border-t border-white/10 pt-2 text-xs"><span className="font-semibold">{item.id}</span><span className="ml-2 text-white/60">expected {item.expected.join(', ') || 'none'} · got {item.actual.join(', ') || 'none'}</span></li>)}</ul>
        </details>
        <p className="mt-3 text-[10px] leading-4 text-white/50">{result.note}</p>
      </>}
    </section>
  )
}
