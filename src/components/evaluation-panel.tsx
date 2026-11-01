'use client'

import { useEffect, useState } from 'react'

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

interface CitationAudit {
  scope: string
  totalFindings: number
  valid: number
  invalid: number
  citationValidity: number | null
  issues: Array<{ findingId: string; submissionTitle: string; sourceCode: string; reason: string; status: string }>
  generatedAt: string
}

function percent(value: number | null) { return value === null ? 'N/A' : `${Math.round(value * 100)}%` }

export function EvaluationPanel() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [audit, setAudit] = useState<CitationAudit | null>(null)
  const [auditBusy, setAuditBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Round 3 commitment 1: on load, show the full-population citation audit
  // (every retained finding re-verified against its approved source and the
  // verbatim draft span) so the 100% target is visible without running anything.
  useEffect(() => {
    let cancelled = false
    async function loadAudit() {
      try {
        const response = await fetch('/api/admin/evaluation')
        if (!response.ok) return
        const data = await response.json() as { citationAudit?: CitationAudit }
        if (!cancelled && data.citationAudit) setAudit(data.citationAudit)
      } catch {
        // The audit is evidence, not a blocker: a failed load stays silent.
      }
    }
    void loadAudit()
    return () => { cancelled = true }
  }, [])

  async function runAudit() {
    setAuditBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/evaluation')
      const data = await response.json() as { citationAudit?: CitationAudit; error?: string }
      if (!response.ok || !data.citationAudit) throw new Error(data.error ?? 'Citation audit could not run.')
      setAudit(data.citationAudit)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Citation audit could not run.')
    } finally {
      setAuditBusy(false)
    }
  }

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
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">Quality lab</p>
          <h2 className="mt-1 text-lg font-semibold">Evidence report</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-white/70">
            The citation audit re-verifies every retained finding against its approved source and
            the verbatim draft span. The labelled run compares source-code findings with four
            labelled examples for precision and recall.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void runAudit()} disabled={auditBusy} className="rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-violet-900 shadow-sm hover:bg-violet-50 disabled:opacity-60">{auditBusy ? 'Auditing…' : 'Re-run citation audit'}</button>
          <button type="button" onClick={() => void run()} disabled={busy} className="rounded-lg border border-white/40 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-60">{busy ? 'Running checks…' : 'Run labelled set'}</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-950/60 px-3 py-2 text-xs text-rose-100">{error}</p>}

      {audit && (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Citation validity</p><p className={`mt-1 text-2xl font-bold ${audit.citationValidity === 1 ? 'text-emerald-300' : ''}`}>{percent(audit.citationValidity)}</p></div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Retained findings</p><p className="mt-1 text-2xl font-bold">{audit.totalFindings}</p></div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Valid</p><p className="mt-1 text-2xl font-bold">{audit.valid}</p></div>
            <div className="rounded-lg border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Invalid</p><p className={`mt-1 text-2xl font-bold ${audit.invalid > 0 ? 'text-rose-300' : ''}`}>{audit.invalid}</p></div>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-white/50">
            Scope: {audit.scope === 'ALL_WORKSPACES' ? 'all workspaces' : 'this brand workspace'} · generated {new Date(audit.generatedAt).toLocaleString()} · Round 3 target: 100% valid source IDs and verbatim spans for retained findings.
          </p>
          {audit.invalid > 0 && (
            <details className="mt-2 rounded-lg border border-rose-300/30 bg-rose-950/40 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-rose-100">{audit.invalid} finding(s) failed verification</summary>
              <ul className="mt-2 space-y-1">{audit.issues.map((issue) => <li key={issue.findingId} className="text-xs text-rose-100/80">[{issue.reason}] {issue.sourceCode} in “{issue.submissionTitle}” ({issue.status.toLowerCase()})</li>)}</ul>
            </details>
          )}
        </div>
      )}

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
