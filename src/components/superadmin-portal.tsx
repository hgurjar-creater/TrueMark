'use client'

import { FormEvent, useState } from 'react'

type Workspace = { id: string; name: string; createdAt: string; admins: { name: string; email: string }[]; users: number; submissions: number }
type Feedback = { id: string; workspace: { name: string } | null; user: { name: string; role: string }; submission: { title: string } | null; helpfulness: number; category: string; comment: string | null; createdAt: string }

export function SuperAdminPortal({ initialWorkspaces, feedback }: { initialWorkspaces: Workspace[]; feedback: Feedback[] }) {
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function createBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setBusy(true)
    setMessage('')
    const form = new FormData(formElement)
    try {
      const response = await fetch('/api/superadmin/workspaces', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: form.get('brandName'), adminName: form.get('adminName'), adminEmail: form.get('adminEmail'), temporaryPassword: form.get('temporaryPassword') }),
      })
      const data = await response.json()
      if (!response.ok) { setMessage(data.error ?? 'Could not create the brand.'); return }
      setWorkspaces((items) => [{ id: data.workspace.id, name: data.workspace.name, createdAt: new Date().toISOString(), admins: [{ name: String(form.get('adminName')), email: data.workspace.adminEmail }], users: 1, submissions: 0 }, ...items])
      formElement.reset()
      setMessage(`Created ${data.workspace.name}. Send its Admin the email and temporary password securely.`)
    } catch { setMessage('Network error. Please try again.') }
    finally { setBusy(false) }
  }

  return <div className="space-y-8">
    <section className="rounded-2xl border border-fuchsia-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-fuchsia-700">New brand</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">Create a brand and its Admin</h2>
      <p className="mt-1 text-sm text-slate-500">Each brand gets a private workspace. Its Admin provisions the brand’s Managers and Creators.</p>
      <form onSubmit={createBrand} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input required name="brandName" minLength={2} maxLength={80} placeholder="Brand or organization name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input required name="adminName" minLength={2} maxLength={80} placeholder="Brand Admin name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input required type="email" name="adminEmail" placeholder="Admin email" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input required type="password" name="temporaryPassword" minLength={12} maxLength={72} placeholder="Temporary password · 12+ characters" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-lg bg-fuchsia-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">{busy ? 'Creating…' : 'Create brand workspace'}</button>
      </form>
      {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>}
      <p className="mt-3 text-xs text-slate-500">Credentials are not shown again after this form. Share them with the Admin through a private channel.</p>
    </section>

    <section>
      <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Tenants</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Brand workspaces</h2></div><span className="text-sm text-slate-500">{workspaces.length} brands</span></div>
      {workspaces.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No brand workspaces yet.</p> : <ul className="grid gap-3 md:grid-cols-2">{workspaces.map((brand) => <li key={brand.id} className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">{brand.name}</h3><p className="mt-1 text-xs text-slate-500">{brand.users} accounts · {brand.submissions} submissions</p><div className="mt-3 border-t border-slate-100 pt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Brand Admin</p>{brand.admins.length ? brand.admins.map((admin) => <p key={admin.email} className="mt-1 text-sm text-slate-700">{admin.name} · {admin.email}</p>) : <p className="mt-1 text-xs text-amber-700">No Admin assigned</p>}</div></li>)}</ul>}
    </section>

    <section className="rounded-2xl border border-sky-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Product learning</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Feedback from all brands</h2></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">{feedback.length} recent</span></div>
      {feedback.length ? <ul className="divide-y divide-slate-100 px-5">{feedback.map((item) => <li key={item.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold text-slate-800">{item.workspace?.name ?? 'Unassigned'} · {item.category.replaceAll('_', ' ')} · {item.helpfulness}/5</p><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div><p className="mt-1 text-xs text-slate-500">{item.user.name} ({item.user.role}){item.submission ? ` · ${item.submission.title}` : ''}</p>{item.comment && <p className="mt-2 text-sm text-slate-700">{item.comment}</p>}</li>)}</ul> : <p className="px-5 py-6 text-sm text-slate-500">No feedback received yet.</p>}
    </section>
  </div>
}
