import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { StatusChip } from '@/components/status-chip'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function MetricCard({ label, value, note, icon }: { label: string; value: number; note: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(50,38,89,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-lg text-violet-700" aria-hidden="true">{icon}</span>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.role === 'SUPER_ADMIN') redirect('/superadmin')
  if (!session.workspaceId) redirect('/login')
  const workspaceId = session.workspaceId

  const isAdmin = session.role === 'ADMIN'
  const isManager = session.role === 'MANAGER'
  const isCreator = session.role === 'CREATOR'
  const [ruleCount, factCount, termCount, recentSubmissions, mySubmissions, auditEntries, userCount, brand] =
    await Promise.all([
      db.rule.count({ where: { approved: true, workspaceId } }),
      db.fact.count({ where: { approved: true, workspaceId } }),
      db.term.count({ where: { approved: true, workspaceId } }),
      db.submission.findMany({
        where: { workspaceId, ...(isCreator ? { creatorId: session.id } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, channel: true, status: true, updatedAt: true, creator: { select: { name: true } } },
      }),
      db.submission.findMany({
        where: { creatorId: session.id, workspaceId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, title: true, channel: true, status: true, updatedAt: true },
      }),
      db.auditLog.findMany({
        where: { actor: { is: { workspaceId } } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: { actor: { select: { name: true } } },
      }),
      db.user.count({ where: { workspaceId } }),
      db.brandProfile.findUnique({ where: { workspaceId }, select: { name: true } }),
    ])

  const reviewQueue = recentSubmissions.filter((submission) => submission.status === 'IN_REVIEW')
  const heading = isCreator ? 'Create with confidence.' : isManager ? 'Keep every review moving.' : 'Your brand, in good shape.'
  const description = isCreator
    ? 'Check a new creative against approved brand guidance before it goes out.'
    : isManager
      ? 'Review the latest work and keep your team aligned with approved brand guidance.'
      : 'A clear view of your approved guidance, recent work and team activity.'

  return (
    <AppShell session={session} active="dashboard">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-[#211d2d] px-6 py-8 text-white shadow-[0_24px_60px_rgba(38,30,63,0.18)] sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-28 -z-10 h-80 w-80 rounded-full bg-violet-500/35 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-8rem] right-[27%] -z-10 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-violet-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                {brand?.name ?? 'Brand workspace'}
              </div>
              <p className="text-sm font-medium text-violet-200">Good to see you, {session.name.split(' ')[0]}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">{description}</p>
            </div>
            <Link
              href={isAdmin ? '/admin' : '/submissions/new'}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50"
            >
              {isAdmin ? 'Manage brand' : 'Start a review'} <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/15 pt-5 text-xs text-slate-300">
            <span><strong className="text-white">{ruleCount + factCount + termCount}</strong> approved guidance items</span>
            <span><strong className="text-white">{userCount}</strong> workspace members</span>
            <span className="capitalize">{session.role.toLowerCase().replace('_', ' ')} workspace</span>
          </div>
        </section>

        <section aria-label="Approved brand library" className="mt-6 grid gap-4 sm:grid-cols-3">
          <MetricCard label="Brand rules" value={ruleCount} note="Approved do’s and don’ts" icon="✳" />
          <MetricCard label="Verified facts" value={factCount} note="Claims your team can use" icon="✓" />
          <MetricCard label="Preferred terms" value={termCount} note="Names, phrases and language" icon="Aa" />
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_12px_35px_rgba(50,38,89,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Workspace activity</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Recent submissions</h2>
              </div>
              <Link href="/submissions" className="text-sm font-semibold text-violet-700 hover:text-violet-900">View all <span aria-hidden="true">→</span></Link>
            </div>
            {recentSubmissions.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-xl text-violet-700" aria-hidden="true">✦</span>
                <h3 className="mt-4 font-semibold text-slate-900">Your first review starts here</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">Submit a caption, campaign or creative and check it against the approved brand library.</p>
                <Link href="/submissions/new" className="mt-5 inline-flex rounded-full bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800">Create a submission</Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentSubmissions.map((submission) => (
                  <li key={submission.id}>
                    <Link href={`/submissions/${submission.id}`} className="group flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-violet-50/50 sm:px-6">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-violet-800">{submission.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">{submission.channel} · {isCreator ? formatDateTime(submission.updatedAt) : `by ${submission.creator.name} · ${formatDateTime(submission.updatedAt)}`}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3"><StatusChip status={submission.status} /><span className="hidden text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-700 sm:inline" aria-hidden="true">→</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_12px_35px_rgba(50,38,89,0.06)]">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">{isManager ? 'Needs attention' : isAdmin ? 'Workspace pulse' : 'Your work'}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{isManager ? 'Review queue' : isAdmin ? 'Latest activity' : 'My submissions'}</h2>
            </div>
            {isManager ? (
              reviewQueue.length === 0 ? <div className="px-6 py-8"><p className="text-sm font-medium text-slate-800">You’re all caught up.</p><p className="mt-1 text-sm text-slate-500">New drafts waiting for review will show up here.</p></div> : (
                <ul className="divide-y divide-slate-100">{reviewQueue.map((submission) => <li key={submission.id}><Link href={`/submissions/${submission.id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-violet-50/50 sm:px-6"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{submission.title}</span><span className="mt-1 block text-xs text-slate-500">From {submission.creator.name}</span></span><StatusChip status={submission.status} /></Link></li>)}</ul>
              )
            ) : isAdmin ? (
              auditEntries.length === 0 ? <p className="px-6 py-8 text-sm text-slate-500">Workspace activity will appear here.</p> : (
                <ul className="divide-y divide-slate-100">{auditEntries.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{entry.action.replaceAll('_', ' ').toLowerCase()}</span><span className="mt-1 block truncate text-xs text-slate-500">{entry.actor?.name ?? 'System'}</span></span><span className="shrink-0 text-right text-[11px] text-slate-400">{formatDateTime(entry.createdAt)}</span></li>)}</ul>
              )
            ) : (
              mySubmissions.length === 0 ? <div className="px-6 py-8"><p className="text-sm font-medium text-slate-800">Nothing submitted yet.</p><p className="mt-1 text-sm text-slate-500">Your personal review history will show up here.</p></div> : (
                <ul className="divide-y divide-slate-100">{mySubmissions.map((submission) => <li key={submission.id}><Link href={`/submissions/${submission.id}`} className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-violet-50/50 sm:px-6"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{submission.title}</span><span className="mt-1 block text-xs text-slate-500">{submission.channel}</span></span><StatusChip status={submission.status} /></Link></li>)}</ul>
              )
            )}
            {isAdmin && <Link href="/admin" className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm font-semibold text-violet-700 transition hover:bg-violet-50/50 sm:px-6"><span>Open brand controls</span><span aria-hidden="true">→</span></Link>}
          </div>
        </section>

        <footer className="mt-8 border-t border-violet-900/10 py-5 text-center text-xs leading-5 text-slate-500">
          AI-assisted reviews are suggestions for a person to assess. Findings without a verified approved source are discarded.
        </footer>
      </main>
    </AppShell>
  )
}
