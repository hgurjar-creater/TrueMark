import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { StatusChip } from '@/components/status-chip'
import { FindingCard, type FindingCardData } from '@/components/finding-card'
import { DiffView } from '@/components/diff-view'
import { CommentForm } from '@/components/comment-form'
import { ApprovalActions } from '@/components/approval-actions'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const submission = await db.submission.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { id: true, name: true } },
      versions: { orderBy: { versionNumber: 'asc' } },
      findings: {
        orderBy: { createdAt: 'asc' },
        include: {
          rule: true,
          fact: true,
          term: true,
          decidedBy: { select: { name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true } } },
      },
    },
  })
  if (!submission) notFound()

  const isOwner = submission.creatorId === session.id
  const canReview = session.role === 'MANAGER' || session.role === 'ADMIN'
  if (!isOwner && !canReview) notFound()

  const latestVersion = submission.versions[submission.versions.length - 1]
  const openCount = submission.findings.filter((finding) => finding.status === 'OPEN').length

  const findings: FindingCardData[] = submission.findings.map((finding) => ({
    id: finding.id,
    reviewedVersion: finding.reviewedVersion,
    sourceType: finding.sourceType,
    sourceCode: finding.sourceCode,
    sourceTitle:
      finding.rule?.title ??
      (finding.fact
        ? `Approved fact ${finding.fact.code}`
        : finding.term
          ? `Approved term "${finding.term.value}"`
          : finding.sourceCode),
    sourceText:
      finding.rule?.text ??
      finding.fact?.statement ??
      (finding.term
        ? `${finding.term.status}: "${finding.term.value}"${
            finding.term.replacement ? ` — use "${finding.term.replacement}" instead. ` : '. '
          }${finding.term.reason}`
        : ''),
    quotedSpan: finding.quotedSpan,
    explanation: finding.explanation,
    suggestedFix: finding.suggestedFix,
    severity: finding.severity,
    confidence: finding.confidence,
    status: finding.status,
    decisionNote: finding.decisionNote,
    decidedByName: finding.decidedBy?.name ?? null,
    canDecide: isOwner && finding.status === 'OPEN',
  }))

  return (
    <AppShell session={session} active="submissions">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <Link href="/submissions" className="text-sm text-indigo-600 hover:underline">
          ← All submissions
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{submission.title}</h1>
          <StatusChip status={submission.status} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {submission.channel}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Submitted by {submission.creator.name} · purpose: {submission.purpose}
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Draft — version {latestVersion.versionNumber}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {latestVersion.content}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Version history and comparison
              </h2>
              {submission.versions.length === 1 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No revisions yet. Accepting or editing a finding creates version 2 with a
                  word-level comparison against this one.
                </p>
              ) : (
                <ol className="mt-4 space-y-5">
                  {submission.versions.map((version, index) => (
                    <li key={version.id}>
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">
                          Version {version.versionNumber}
                        </span>{' '}
                        · {formatDateTime(version.createdAt)} · {version.note}
                      </p>
                      {index > 0 && (
                        <div className="mt-2">
                          <DiffView
                            oldContent={submission.versions[index - 1].content}
                            newContent={version.content}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="space-y-6">
            {canReview && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Manager decision</h2>
                <div className="mt-3">
                  <ApprovalActions
                    submissionId={submission.id}
                    disabled={submission.status === 'PUBLISHED'}
                  />
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Findings{' '}
                <span className="text-sm font-normal text-slate-400">
                  ({openCount} open of {findings.length})
                </span>
              </h2>
              {findings.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No findings. Nothing in this draft tripped an approved rule, fact or term.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {findings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Comments</h2>
              {submission.comments.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No comments yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {submission.comments.map((comment) => (
                    <li key={comment.id} className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{comment.author.name}</span> ·{' '}
                        {formatDateTime(comment.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                        {comment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <CommentForm submissionId={submission.id} />
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  )
}
