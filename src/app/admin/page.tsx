import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Logo } from '@/components/logo'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'
import { LibraryManager, type LibraryData } from '@/components/library-manager'
import { LibraryImporter } from '@/components/library-importer'
import { UserProvisioner } from '@/components/user-provisioner'
import { BrandProfileManager } from '@/components/brand-profile-manager'
import { getBrandProfile } from '@/lib/brand-profile'
import { GuidelineInsights } from '@/components/guideline-insights'
import { buildGuidelineInsights } from '@/lib/review/insights'
import { EvaluationPanel } from '@/components/evaluation-panel'
import type { Role } from '@/lib/validation'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export default async function AdminPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'SUPER_ADMIN') redirect('/superadmin')
  if (session.role !== 'ADMIN') redirect('/dashboard')
  if (!session.workspaceId) redirect('/login?role=ADMIN')

  const workspaceId = session.workspaceId
  const [users, rules, facts, terms, logs, profile, insights] = await Promise.all([
    db.user.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } }),
    db.rule.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }),
    db.fact.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }),
    db.term.findMany({ where: { workspaceId }, orderBy: { code: 'asc' } }),
    db.auditLog.findMany({
      where: { actor: { is: { workspaceId } } }, orderBy: { createdAt: 'desc' },
      take: 15,
      include: { actor: { select: { name: true } } },
    }),
    getBrandProfile(workspaceId),
    buildGuidelineInsights(workspaceId),
  ])

  const initial: LibraryData = {
    rules: rules.map(({ id, code, title, text, category, approved }) => ({ id, code, title, text, category, approved })),
    facts: facts.map(({ id, code, statement, source, expiresAt, approved }) => ({
      id,
      code,
      statement,
      source,
      expiresAt: expiresAt?.toISOString().slice(0, 10) ?? '',
      approved,
    })),
    terms: terms.map(({ id, code, value, status, replacement, reason, approved }) => ({
      id,
      code,
      value,
      status,
      replacement,
      reason,
      approved,
    })),
  }
  const workspaceUsers = users
    .filter((user) => user.role === 'MANAGER' || user.role === 'CREATOR')
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
      createdAt: user.createdAt,
    }))

  return (
    <div className="min-h-screen">
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard"><Logo /></Link>
            <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">Dashboard</Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session.name}</span>
            <RoleBadge role={session.role} />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-7 px-6 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-600">Workspace controls</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Admin panel</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Manage the approved library that powers TrueMark reviews. Draft entries stay out of new findings until approved.
          </p>
        </div>

        <LibraryImporter />

        <BrandProfileManager initial={{
          name: profile.name,
          palette: profile.palette,
          logoPreview: profile.logoData && profile.logoMimeType
            ? `data:${profile.logoMimeType};base64,${profile.logoData}`
            : null,
          logoFileName: profile.logoFileName,
        }} />

        <GuidelineInsights initial={insights} />

        <EvaluationPanel />

        <LibraryManager initial={initial} />

        <UserProvisioner
          endpoint="/api/admin/users"
          initialUsers={workspaceUsers}
          roles={['MANAGER', 'CREATOR']}
          title="Workspace accounts"
          description="Create and provision Manager or Creator access for your team."
        />

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-semibold text-slate-900 sm:px-6">Users <span className="text-sm font-normal text-slate-400">({users.length})</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Name</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Email</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Role</th>
                  <th className="px-5 py-2.5 font-medium sm:px-6">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-5 py-3 font-medium text-slate-800 sm:px-6">{user.name}</td>
                    <td className="px-5 py-3 text-slate-600 sm:px-6">{user.email}</td>
                    <td className="px-5 py-3 sm:px-6"><RoleBadge role={user.role as Role} /></td>
                    <td className="px-5 py-3 text-slate-500 sm:px-6">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-5 py-4 text-base font-semibold text-slate-900 sm:px-6">Recent audit activity</h2>
          {logs.length === 0 ? (
            <p className="px-6 py-5 text-sm text-slate-500">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 px-5 sm:px-6">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="text-slate-800">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-slate-400"> · {log.entityType}</span>
                    {log.actor && <span className="text-slate-400"> · {log.actor.name}</span>}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
