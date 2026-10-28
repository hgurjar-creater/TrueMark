'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Candidates {
  rules: { title: string; text: string; category?: string }[]
  facts: { statement: string; source: string }[]
  terms: { value: string; status: string; replacement?: string; reason: string }[]
}

export function LibraryImporter() {
  const router = useRouter()
  const [fileName, setFileName] = useState<string | null>(null)
  const [provider, setProvider] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidates | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)

  const total = candidates
    ? candidates.rules.length + candidates.facts.length + candidates.terms.length
    : 0

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setReading(true)
    setError(null)
    setNotice(null)
    setCandidates(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/library/import', { method: 'POST', body: form })
      const data = (await res.json()) as {
        fileName?: string
        provider?: string
        candidates?: Candidates
        error?: string
      }
      if (!res.ok || !data.candidates) {
        setError(data.error ?? 'Could not read the file.')
        return
      }
      setFileName(data.fileName ?? file.name)
      setProvider(data.provider ?? null)
      setCandidates(data.candidates)
    } catch {
      setError('Network error while uploading the file.')
    } finally {
      setReading(false)
      event.target.value = ''
    }
  }

  async function confirmImport() {
    if (!candidates) return
    setImporting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/library/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidates),
      })
      const data = (await res.json()) as {
        rules?: number
        facts?: number
        terms?: number
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Import failed.')
        return
      }
      setNotice(
        `Imported ${data.rules} rules, ${data.facts} facts and ${data.terms} terms as drafts. Approve each one below to make it citable.`,
      )
      setCandidates(null)
      setFileName(null)
      setProvider(null)
      router.refresh()
    } catch {
      setError('Network error during import.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Import from a file</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Upload a Word, PDF or text file of brand guidelines. Candidate rules, facts and terms
            are extracted for your review and saved as drafts — nothing becomes citable until you
            approve it.
          </p>
        </div>
        <label
          htmlFor="library-file"
          className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
        >
          {reading ? 'Reading file…' : 'Choose file'}
        </label>
        <input
          id="library-file"
          type="file"
          accept=".docx,.pdf,.txt,.md"
          onChange={handleFile}
          disabled={reading}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700" role="status">
          {notice}
        </p>
      )}

      {candidates && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            “{fileName}” via {provider === 'gemini' ? 'Gemini extraction' : 'built-in parser'} —{' '}
            {total} candidate item{total === 1 ? '' : 's'} found. Review before importing.
          </p>
          {candidates.rules.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rules ({candidates.rules.length})
              </p>
              <ul className="mt-1 space-y-1">
                {candidates.rules.map((rule, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">{rule.title}</span> — {rule.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidates.facts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Facts ({candidates.facts.length})
              </p>
              <ul className="mt-1 space-y-1">
                {candidates.facts.map((fact, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {fact.statement} <span className="text-xs text-slate-400">(source: {fact.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {candidates.terms.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Terms ({candidates.terms.length})
              </p>
              <ul className="mt-1 space-y-1">
                {candidates.terms.map((term, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    “{term.value}” <span className="font-medium">{term.status}</span>
                    {term.replacement ? ` → use “${term.replacement}”` : ''} — {term.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {total === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No candidates were found in this file. You can still add items manually below.
            </p>
          )}
          {total > 0 && (
            <button
              type="button"
              onClick={confirmImport}
              disabled={importing}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {importing ? 'Importing…' : `Import ${total} item${total === 1 ? '' : 's'} as drafts`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
