'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ROLES, type Role } from '@/lib/validation'

const demoAccounts = ['superadmin@truemark.test', 'admin@truemark.test', 'manager@truemark.test', 'creator@truemark.test']
const demoPassword = 'truemark1234'
const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CREATOR: 'Creator',
}
const homeByRole: Record<Role, string> = {
  SUPER_ADMIN: '/superadmin',
  ADMIN: '/admin',
  MANAGER: '/dashboard',
  CREATOR: '/dashboard',
}

export function LoginForm({
  registrationOpen,
  requestedRole,
}: {
  registrationOpen: boolean
  requestedRole?: string
}) {
  const router = useRouter()
  const expectedRole =
    requestedRole && (ROLES as readonly string[]).includes(requestedRole)
      ? (requestedRole as Role)
      : undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ...(expectedRole ? { expectedRole } : {}) }),
      })
      const data = (await res.json()) as { error?: string; user?: { role: Role } }
      if (!res.ok) {
        setError(data.error ?? 'Unable to sign in.')
        return
      }
      const next = new URLSearchParams(window.location.search).get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
      router.push(safeNext ?? homeByRole[data.user?.role ?? 'CREATOR'])
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">
          {expectedRole ? `${roleLabels[expectedRole]} sign in` : 'Sign in'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Use the email and password you were given by your administrator.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {registrationOpen ? (
          <p className="mt-4 text-center text-sm text-slate-500">
            No Super Admin account yet?{' '}
            <Link href="/register" className="font-medium text-indigo-600 hover:underline">
              Create it
            </Link>{' '}
            — the first sign-up becomes Super Admin.
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-slate-500">
            Brand Admin accounts come from Super Admin. Managers and Creators receive credentials from their brand Admin.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
        {process.env.NODE_ENV !== 'production' ? (
          <>
            <p className="font-semibold text-slate-700">Local demo accounts</p>
            <p className="mt-1">{demoAccounts.join(' · ')}</p>
            <p>
              Password for seeded accounts:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">{demoPassword}</code>
            </p>
            <p className="mt-1">The first account created through Sign up becomes Super Admin.</p>
          </>
        ) : (
          <p>Need access? Contact your workspace administrator for credentials.</p>
        )}
      </div>
    </>
  )
}
