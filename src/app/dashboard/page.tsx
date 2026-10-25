import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Logo } from '@/components/logo'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'

const statusStyles: Record<string, string> = {
  IN_REVIEW: 'bg-sky-100 text-sky-700',
  CHANGES_REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PUBLISHED: 'bg-violet-100 text-violet-700',
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        statusStyles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {status.replace('_', ' ').toLowerCase()}
    </span>
  )
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const isAdmin = session.role === 'ADMIN'
  const isManager = session.role === 'MANAGER'
  const isCreator = session.role === 'CREATOR'

  const [ruleCount, factCount, termCount, recentSubmissions, mySubmissions, auditEntries, userCount] =
    await Promise.all([
      db.rule.count({ where: { approved: true } }),
      db.fact.count({ where: { approved: true } }),
      db.term.count({ where: { approved: true } }),
      db.submission.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { creator: { select: { name: true } } },
      }),
      db.submission.findMany({
        where: { creatorId: session.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { name: true } } },
      }),
      db.user.count(),
    ])

  const reviewQueue = recentSubmissions.filter((s) => s.status === 'IN_REVIEW')

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Logo />
            </Link>
            {isAdmin && (
              <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Admin panel
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session.name}</span>
            <RoleBadge role={session.role} />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Welcome back, {session.name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Draft submission and review arrive in the next build phase. Everything below is live data.
        </p>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Approved rules</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{ruleCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Approved facts</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{factCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Approved terms</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{termCount}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {isCreator && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Your submissions</h2>
              {mySubmissions.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No submissions yet. The draft submission form lands in the next build phase.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {mySubmissions.map((submission) => (
                    <li key={submission.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-medium text-slate-800">{submission.title}</span>
                      <StatusChip status={submission.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isManager && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Review queue</h2>
              {reviewQueue.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Nothing waiting for review right now.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {reviewQueue.map((submission) => (
                    <li key={submission.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm font-medium text-slate-800">
                        {submission.title}
                        <span className="ml-2 text-xs text-slate-400">by {submission.creator.name}</span>
                      </span>
                      <StatusChip status={submission.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Recent activity (audit log)</h2>
              {auditEntries.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No activity recorded yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {auditEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between py-2.5">
                      <span className="text-sm text-slate-800">
                        <span className="font-medium">{entry.action}</span>
                        {entry.actor && <span className="text-slate-400"> · {entry.actor.name}</span>}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-400">{userCount} registered users.</p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Latest submissions (all)</h2>
            {recentSubmissions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No submissions exist yet. They will appear here as soon as the first draft is
                reviewed.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {recentSubmissions.map((submission) => (
                  <li key={submission.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium text-slate-800">
                      {submission.title}
                      <span className="ml-2 text-xs text-slate-400">by {submission.creator.name}</span>
                    </span>
                    <StatusChip status={submission.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-4 text-center text-xs text-slate-500">
          AI disclosure: automated reviews may use AI assistance. All AI calls are logged and
          findings without a verified approved source are discarded.
        </div>
      </footer>
    </div>
  )
}
