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
import type { VisualReport } from '@backend/review/visual'
import type { AccessibilityReport } from '@/lib/review/accessibility'
import { ReviewFeedback } from '@/components/review-feedback'
import { ReviewProcessingStatus } from '@/components/review-processing-status'

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.workspaceId) notFound()

  const submission = await db.submission.findUnique({
    where: { id: params.id, workspaceId: session.workspaceId },
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
  const visualReport: VisualReport | null = submission.visualReview
    ? JSON.parse(submission.visualReview) as VisualReport
    : null
  const accessibility: AccessibilityReport | null = submission.accessibilityReview
    ? JSON.parse(submission.accessibilityReview) as AccessibilityReport
    : null
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
    canDecide: isOwner && finding.status === 'OPEN' && submission.reviewStatus === 'COMPLETED',
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
        {submission.reviewStatus !== 'COMPLETED' && <ReviewProcessingStatus submissionId={submission.id} initialStatus={submission.reviewStatus} />}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/submissions/${submission.id}/report`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Open review report</Link>
          {visualReport && <span className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800">Visual check · {visualReport.width} × {visualReport.height}</span>}
        </div>

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

            {(submission.imageStorageKey || submission.imageData) && submission.imageMimeType && (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-6 py-4">
                  <h2 className="text-base font-semibold text-slate-900">Submitted creative</h2>
                  <p className="mt-1 text-xs text-slate-500">{submission.imageName}</p>
                </div>
                <div className="bg-slate-50 p-4 sm:p-6">
                  <img src={`/api/submissions/${submission.id}/image`} alt={submission.imageAltText || ''} className="mx-auto max-h-[520px] max-w-full rounded-xl object-contain shadow-sm" />
                </div>
                {submission.imageAltText && <p className="border-t border-slate-100 px-6 py-3 text-xs leading-5 text-slate-600"><span className="font-semibold text-slate-800">Alt text:</span> {submission.imageAltText}</p>}
              </div>
            )}

            {accessibility && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-sky-700">Inclusive content</p><h2 className="mt-1 text-base font-semibold text-slate-900">Accessibility check</h2></div>
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">{accessibility.readingLevel}{accessibility.readingEase !== null ? ` · ${accessibility.readingEase}/100` : ''}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{accessibility.wordCount} words · {accessibility.sentenceCount} sentences · {accessibility.averageWordsPerSentence} words per sentence on average</p>
                {accessibility.issues.length === 0 ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No accessibility suggestions were triggered by these checks.</p> : (
                  <ul className="mt-4 space-y-3">{accessibility.issues.map((issue, index) => <li key={`${issue.category}-${index}`} className="rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-800">{issue.message}</p><p className="mt-1 text-xs leading-5 text-slate-600">{issue.evidence}</p><p className="mt-2 text-xs leading-5 text-sky-800">Suggestion: {issue.recommendation}</p></li>)}</ul>
                )}
              </section>
            )}

            {visualReport && (
              <section className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-violet-700">Brand integrity</p><h2 className="mt-1 text-base font-semibold text-slate-900">Visual review</h2></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${visualReport.provider === 'gemini' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{visualReport.provider === 'gemini' ? 'AI-assisted' : 'Local measurements only'}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{visualReport.summary}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Canvas</p><p className="mt-1 text-sm font-semibold text-slate-800">{visualReport.width} × {visualReport.height} <span className="font-normal text-slate-500">({visualReport.aspectRatio})</span></p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Approx. approved palette coverage</p><p className="mt-1 text-sm font-semibold text-slate-800">{visualReport.paletteCoveragePercent === null ? 'No palette configured' : `${visualReport.paletteCoveragePercent}%`} <span className="font-normal text-slate-500">(pixel sample, not a pass/fail score)</span></p></div>
                  <div className="rounded-xl bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Primary brand color</p><p className="mt-1 text-sm font-semibold text-slate-800">{visualReport.primaryColorCoveragePercent === null ? 'No palette configured' : `${visualReport.primaryColorCoveragePercent}%`} <span className="font-normal text-slate-500">(approximate pixel sample)</span></p></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">{visualReport.dominantColors.map((color) => <span key={color} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-mono text-slate-700"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />{color}</span>)}</div>
                {visualReport.findings.length === 0 ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">No visual issues were identified against the configured references. Human review still applies.</p> : (
                  <ul className="mt-4 space-y-3">{visualReport.findings.map((issue, index) => <li key={`${issue.category}-${index}`} className="rounded-xl bg-violet-50/70 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-800">{issue.category}</span><span className={`text-[9px] font-bold uppercase ${issue.severity === 'HIGH' ? 'text-rose-700' : issue.severity === 'MEDIUM' ? 'text-amber-700' : 'text-slate-500'}`}>{issue.severity}</span><h3 className="text-sm font-semibold text-slate-900">{issue.title}</h3></div><p className="mt-2 text-xs leading-5 text-slate-700">{issue.evidence}</p><p className="mt-2 text-xs leading-5 text-violet-900">Suggestion: {issue.recommendation}</p><p className="mt-2 text-[10px] text-slate-500">{Math.round(issue.confidence * 100)}% confidence{issue.confidence < 0.6 ? ' · needs human judgment' : ''}</p></li>)}</ul>
                )}
                {visualReport.providerError && <p className="mt-3 text-[10px] text-amber-700">Visual model note: {visualReport.providerError}</p>}
                <p className="mt-4 border-t border-violet-100 pt-3 text-[10px] leading-5 text-slate-500">Visual findings are suggestions for a person to review; they do not approve, edit or publish the creative.</p>
              </section>
            )}

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
                {openCount > 0 && submission.status !== 'PUBLISHED' && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    ⚠ {openCount} finding{openCount === 1 ? ' is' : 's are'} still open on this
                    submission. Approving records your decision but does not resolve them — make
                    sure that is intentional.
                  </p>
                )}
                <div className="mt-3">
                  <ApprovalActions
                    submissionId={submission.id}
                    disabled={submission.status === 'PUBLISHED' || submission.reviewStatus !== 'COMPLETED'}
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
            <ReviewFeedback submissionId={submission.id} />
          </section>
        </div>
      </main>
    </AppShell>
  )
}
