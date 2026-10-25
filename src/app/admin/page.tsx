import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Logo } from '@/components/logo'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'No expiry'
}

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role !== 'ADMIN') redirect('/dashboard')

  const [users, rules, facts, terms, logs] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: 'asc' } }),
    db.rule.findMany({ orderBy: { code: 'asc' } }),
    db.fact.findMany({ orderBy: { code: 'asc' } }),
    db.term.findMany({ orderBy: { code: 'asc' } }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { actor: { select: { name: true } } },
    }),
  ])

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session.name}</span>
            <RoleBadge role={session.role} />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Read-only overview of the approved library. Creating and editing rules, facts and terms
            arrives in the next build phase.
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-slate-900">
            Users ({users.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 font-medium">Name</th>
                <th className="px-6 py-2.5 font-medium">Email</th>
                <th className="px-6 py-2.5 font-medium">Role</th>
                <th className="px-6 py-2.5 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-3 font-medium text-slate-800">{user.name}</td>
                  <td className="px-6 py-3 text-slate-600">{user.email}</td>
                  <td className="px-6 py-3">
                    <RoleBadge role={user.role as 'ADMIN' | 'MANAGER' | 'CREATOR'} />
                  </td>
                  <td className="px-6 py-3 text-slate-500">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-slate-900">
            Rules ({rules.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 font-medium">Code</th>
                <th className="px-6 py-2.5 font-medium">Title</th>
                <th className="px-6 py-2.5 font-medium">Category</th>
                <th className="px-6 py-2.5 font-medium">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-6 py-3 font-mono text-xs text-indigo-600">{rule.code}</td>
                  <td className="px-6 py-3 font-medium text-slate-800">{rule.title}</td>
                  <td className="px-6 py-3 text-slate-600">{rule.category ?? '—'}</td>
                  <td className="px-6 py-3">
                    {rule.approved ? (
                      <span className="text-emerald-600">Yes</span>
                    ) : (
                      <span className="text-slate-400">Draft</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-slate-900">
            Facts ({facts.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 font-medium">Code</th>
                <th className="px-6 py-2.5 font-medium">Statement</th>
                <th className="px-6 py-2.5 font-medium">Source</th>
                <th className="px-6 py-2.5 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facts.map((fact) => (
                <tr key={fact.id}>
                  <td className="px-6 py-3 font-mono text-xs text-indigo-600">{fact.code}</td>
                  <td className="px-6 py-3 text-slate-800">{fact.statement}</td>
                  <td className="px-6 py-3 text-slate-500">{fact.source}</td>
                  <td className="px-6 py-3 text-slate-500">{formatDate(fact.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-slate-900">
            Terms ({terms.length})
          </h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-2.5 font-medium">Code</th>
                <th className="px-6 py-2.5 font-medium">Term</th>
                <th className="px-6 py-2.5 font-medium">Status</th>
                <th className="px-6 py-2.5 font-medium">Replacement</th>
                <th className="px-6 py-2.5 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terms.map((term) => (
                <tr key={term.id}>
                  <td className="px-6 py-3 font-mono text-xs text-indigo-600">{term.code}</td>
                  <td className="px-6 py-3 font-medium text-slate-800">{term.value}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        term.status === 'BANNED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {term.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-600">{term.replacement ?? '—'}</td>
                  <td className="px-6 py-3 text-slate-500">{term.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-4 text-base font-semibold text-slate-900">
            Audit log (latest {logs.length})
          </h2>
          <ul className="divide-y divide-slate-100 px-6">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-800">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-slate-400"> · {log.entityType}</span>
                  {log.actor && <span className="text-slate-400"> · {log.actor.name}</span>}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
