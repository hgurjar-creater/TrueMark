import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { StatusChip } from '@/components/status-chip'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function SubmissionsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.workspaceId) redirect('/login')

  const isCreator = session.role === 'CREATOR'
  const submissions = await db.submission.findMany({
    where: { workspaceId: session.workspaceId, ...(isCreator ? { creatorId: session.id } : {}) },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, channel: true, status: true, updatedAt: true,
      creator: { select: { name: true } },
    },
  })

  return (
    <AppShell session={session} active="submissions">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Submissions</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isCreator
                ? 'Your drafts and their review records.'
                : 'Every draft reviewed against the approved library.'}
            </p>
          </div>
          <Link
            href="/submissions/new"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            New submission
          </Link>
        </div>

        {submissions.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-sm text-slate-500">
              No submissions yet. Paste a draft and TrueMark will check it against the approved
              rules, facts and terms before publication.
            </p>
            <Link
              href="/submissions/new"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {submissions.map((submission) => (
              <li key={submission.id}>
                <Link
                  href={`/submissions/${submission.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 transition hover:bg-slate-50"
                >
                  <span>
                    <span className="text-sm font-semibold text-slate-900">{submission.title}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {submission.channel} · by {submission.creator.name}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{formatDateTime(submission.updatedAt)}</span>
                    <StatusChip status={submission.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppShell>
  )
}
