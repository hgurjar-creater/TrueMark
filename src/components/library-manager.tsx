'use client'

import { useState, type FormEvent } from 'react'

type LibraryKind = 'rules' | 'facts' | 'terms'
type FieldValue = string | boolean | null
export type LibraryRow = Record<string, FieldValue> & { id: string; code: string; approved: boolean }
export type LibraryData = Record<LibraryKind, LibraryRow[]>
type Draft = Record<string, FieldValue>

const sections: Array<{
  kind: LibraryKind
  title: string
  description: string
  fields: Array<{ key: string; label: string; type?: 'textarea' | 'date' | 'select'; required?: boolean; options?: string[] }>
}> = [
  {
    kind: 'rules',
    title: 'Rules',
    description: 'Brand, legal and style guidance used to explain review findings.',
    fields: [
      { key: 'code', label: 'Code', required: true },
      { key: 'title', label: 'Title', required: true },
      { key: 'category', label: 'Category' },
      { key: 'text', label: 'Rule guidance', type: 'textarea', required: true },
    ],
  },
  {
    kind: 'facts',
    title: 'Facts',
    description: 'Approved claims and their supporting source material.',
    fields: [
      { key: 'code', label: 'Code', required: true },
      { key: 'statement', label: 'Approved statement', type: 'textarea', required: true },
      { key: 'source', label: 'Source', required: true },
      { key: 'expiresAt', label: 'Expires on', type: 'date' },
    ],
  },
  {
    kind: 'terms',
    title: 'Terms',
    description: 'Preferred or restricted wording and suggested replacements.',
    fields: [
      { key: 'code', label: 'Code', required: true },
      { key: 'value', label: 'Term', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['BANNED', 'PREFERRED'], required: true },
      { key: 'replacement', label: 'Suggested replacement' },
      { key: 'reason', label: 'Reason', type: 'textarea', required: true },
    ],
  },
]

function blankDraft(kind: LibraryKind): Draft {
  const fields = sections.find((section) => section.kind === kind)?.fields ?? []
  return Object.fromEntries([
    ...fields.map((field) => [field.key, field.key === 'status' ? 'BANNED' : '']),
    ['approved', false],
  ])
}

function getSummary(kind: LibraryKind, row: LibraryRow): string {
  if (kind === 'rules') return String(row.title ?? '')
  if (kind === 'facts') return String(row.statement ?? '')
  return `${String(row.value ?? '')} · ${String(row.status ?? '')}`
}

function getDetails(kind: LibraryKind, row: LibraryRow): string {
  if (kind === 'rules') return [row.category, row.text].filter(Boolean).join(' · ')
  if (kind === 'facts') return [row.source, row.expiresAt ? `Expires ${String(row.expiresAt).slice(0, 10)}` : null].filter(Boolean).join(' · ')
  return [row.replacement ? `Use ${String(row.replacement)}` : null, row.reason].filter(Boolean).join(' · ')
}

export function LibraryManager({ initial }: { initial: LibraryData }) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <LibrarySection key={section.kind} section={section} initialItems={initial[section.kind]} />
      ))}
    </div>
  )
}

function LibrarySection({
  section,
  initialItems,
}: {
  section: (typeof sections)[number]
  initialItems: LibraryRow[]
}) {
  const [items, setItems] = useState(initialItems)
  const [draft, setDraft] = useState<Draft>(() => blankDraft(section.kind))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function startEdit(item: LibraryRow) {
    setEditingId(item.id)
    setDraft(Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value ?? ''])))
    setError(null)
    setNotice(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(blankDraft(section.kind))
    setError(null)
  }

  async function reloadItems() {
    const response = await fetch(`/api/admin/library/${section.kind}`, { cache: 'no-store' })
    const result = (await response.json()) as { items?: LibraryRow[]; error?: string }
    if (!response.ok || !result.items) throw new Error(result.error ?? 'Unable to refresh the library.')
    setItems(result.items)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)
    const body = { ...draft }
    if (section.kind === 'facts') {
      const expiration = String(body.expiresAt ?? '')
      body.expiresAt = expiration ? new Date(`${expiration}T00:00:00.000Z`).toISOString() : null
    }
    try {
      const response = await fetch(
        editingId ? `/api/admin/library/${section.kind}/${editingId}` : `/api/admin/library/${section.kind}`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Unable to save this item.')
        return
      }
      await reloadItems()
      setNotice(editingId ? 'Changes saved.' : 'Library item created.')
      setEditingId(null)
      setDraft(blankDraft(section.kind))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  async function remove(item: LibraryRow) {
    if (!window.confirm(`Delete ${item.code}? This cannot be undone.`)) return
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/library/${section.kind}/${item.id}`, { method: 'DELETE' })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(result.error ?? 'Unable to delete this item.')
        return
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      if (editingId === item.id) cancelEdit()
      setNotice(`${item.code} deleted.`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{section.title} <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{items.length}</span></h2>
          <p className="mt-1 text-xs text-slate-500">{section.description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{items.filter((item) => item.approved).length} approved</span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
        <div className="divide-y divide-slate-100 px-5 sm:px-6">
          {items.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">No {section.title.toLowerCase()} yet. Add the first item using the form.</p>
          ) : items.map((item) => (
            <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-violet-700">{item.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${item.approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.approved ? 'Approved' : 'Draft'}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-900">{getSummary(section.kind, item)}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{getDetails(section.kind, item)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => startEdit(item)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Edit</button>
                <button type="button" onClick={() => void remove(item)} disabled={pending} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50">Delete</button>
              </div>
            </article>
          ))}
        </div>

        <form onSubmit={save} className="border-t border-slate-100 bg-[#fbfaff]/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{editingId ? `Edit ${section.title.slice(0, -1)}` : `Add ${section.title.slice(0, -1)}`}</h3>
            {editingId && <button type="button" onClick={cancelEdit} className="text-xs font-medium text-slate-500 hover:text-slate-800">Cancel</button>}
          </div>
          <div className="space-y-3">
            {section.fields.map((field) => (
              <label key={field.key} className="block text-xs font-medium text-slate-600">
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea required={field.required} rows={field.key === 'text' || field.key === 'statement' ? 3 : 2} maxLength={field.key === 'text' ? 4000 : 2000} value={String(draft[field.key] ?? '')} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-violet-300" />
                ) : field.type === 'select' ? (
                  <select required={field.required} value={String(draft[field.key] ?? '')} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-300">
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : (
                  <input required={field.required} type={field.type ?? 'text'} maxLength={field.key === 'code' ? 40 : undefined} value={String(draft[field.key] ?? '')} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-violet-300" />
                )}
              </label>
            ))}
            <label className="flex items-start gap-2.5 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-xs text-slate-700">
              <input type="checkbox" checked={Boolean(draft.approved)} onChange={(event) => setDraft((current) => ({ ...current, approved: event.target.checked }))} className="mt-0.5 accent-violet-600" />
              <span><span className="font-semibold">Approved for review</span><span className="mt-0.5 block text-[10px] leading-4 text-slate-500">Only approved items can be used as sources for new findings.</span></span>
            </label>
          </div>
          {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p>}
          {notice && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">{notice}</p>}
          <button type="submit" disabled={pending} className="mt-4 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60">{pending ? 'Saving…' : editingId ? 'Save changes' : `Add ${section.title.slice(0, -1)}`}</button>
        </form>
      </div>
    </section>
  )
}
