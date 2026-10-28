'use client'

import { useState, type FormEvent } from 'react'
import type { Role } from '@/lib/validation'
import { RoleBadge } from '@/components/role-badge'

type AssignableRole = Extract<Role, 'ADMIN' | 'MANAGER' | 'CREATOR'>
type ManagedUser = { id: string; name: string; email: string; role: Role; createdAt: string | Date }

export function UserProvisioner({
  endpoint,
  initialUsers,
  roles,
  title,
  description,
}: {
  endpoint: string
  initialUsers: ManagedUser[]
  roles: AssignableRole[]
  title: string
  description: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AssignableRole>(roles[0])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string; role: Role } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setNotice(null)
    setCreatedCredential(null)
    setCopied(false)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, ...(roles.length > 1 ? { role } : {}) }),
      })
      const result = (await response.json()) as { user?: ManagedUser; error?: string }
      if (!response.ok || !result.user) {
        setError(result.error ?? 'Unable to create the account.')
        return
      }
      setUsers((current) => [result.user!, ...current])
      setNotice(`${result.user.name} now has a ${result.user.role.replace('_', ' ').toLowerCase()} account. Share these credentials privately.`)
      setCreatedCredential({ email: result.user.email, password, role: result.user.role })
      setName('')
      setEmail('')
      setPassword('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="grid gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1.1fr_.9fr]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title} <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{users.length}</span></h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        {users.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No accounts yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                </div>
                <RoleBadge role={user.role} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={createAccount} className="border-t border-slate-100 bg-[#fbfaff]/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
        <h3 className="text-sm font-semibold text-slate-900">Create an account</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">The password is stored as a one-way hash. Share the temporary password securely after creation.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-slate-600">Full name
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-300" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" maxLength={160} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-300" />
          </label>
          <label className="block text-xs font-medium text-slate-600">Temporary password
            <input value={password} onChange={(event) => setPassword(event.target.value)} required type="password" minLength={12} maxLength={72} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-300" />
            <span className="mt-1 block text-[10px] text-slate-400">At least 12 characters.</span>
          </label>
          {roles.length > 1 && (
            <label className="block text-xs font-medium text-slate-600">Role
              <select value={role} onChange={(event) => setRole(event.target.value as AssignableRole)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-violet-300">
                {roles.map((option) => <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}
              </select>
            </label>
          )}
        </div>
        {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">{error}</p>}
        {notice && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700" role="status">{notice}</p>}
        {createdCredential && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs text-slate-700">
            <p><span className="font-semibold">Email:</span> {createdCredential.email}</p>
            <p className="mt-1"><span className="font-semibold">Temporary password:</span> <code>{createdCredential.password}</code></p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(`${createdCredential.email}\n${createdCredential.password}`); setCopied(true) }} className="font-semibold text-violet-700 hover:underline">{copied ? 'Copied' : 'Copy credentials'}</button>
              <button type="button" onClick={() => setCreatedCredential(null)} className="font-medium text-slate-500 hover:text-slate-800">Hide</button>
            </div>
          </div>
        )}
        <button type="submit" disabled={pending} className="mt-4 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60">{pending ? 'Creating…' : 'Create account'}</button>
      </form>
    </section>
  )
}
