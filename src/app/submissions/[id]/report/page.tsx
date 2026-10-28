import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { VisualReport } from '@backend/review/visual'
import type { AccessibilityReport } from '@/lib/review/accessibility'
import { PrintReportButton } from '@/components/print-report-button'

export default async function SubmissionReportPage({ params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.workspaceId) notFound()
  const item = await db.submission.findUnique({
    where: { id: params.id, workspaceId: session.workspaceId },
    include: {
      creator: { select: { name: true } },
      versions: { orderBy: { versionNumber: 'asc' } },
      findings: { orderBy: { createdAt: 'asc' }, include: { decidedBy: { select: { name: true } } } },
      comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } } },
      aiLogs: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!item) notFound()
  if (item.creatorId !== session.id && !['ADMIN', 'MANAGER'].includes(session.role)) notFound()
  const visual: VisualReport | null = item.visualReview ? JSON.parse(item.visualReview) as VisualReport : null
  const accessibility: AccessibilityReport | null = item.accessibilityReview ? JSON.parse(item.accessibilityReview) as AccessibilityReport : null
  const generated = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/submissions/${item.id}`} className="text-sm font-medium text-violet-700 hover:underline">← Back to review</Link>
          <PrintReportButton />
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
          <header className="border-b border-slate-200 pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-700">TrueMark · Brand review record</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">{item.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{item.channel} · {item.status.replaceAll('_', ' ')} · Created {item.createdAt.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-sm text-slate-600">Creator: {item.creator.name} · Purpose: {item.purpose}</p>
            <p className="mt-1 text-xs text-slate-400">Report generated {generated} · Ref {item.id}</p>
          </header>

          {(item.imageStorageKey || item.imageData) && item.imageMimeType && <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Submitted creative</h2><img src={`/api/submissions/${item.id}/image`} alt={item.imageAltText || ''} className="mt-3 max-h-[440px] max-w-full rounded-xl object-contain" />{item.imageAltText && <p className="mt-2 text-xs text-slate-500">Alt text: {item.imageAltText}</p>}</section>}

          <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Reviewed draft · {item.versions.length} version{item.versions.length === 1 ? '' : 's'}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.versions[item.versions.length - 1]?.content ?? item.content}</p></section>

          <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Text findings ({item.findings.length})</h2>{item.findings.length === 0 ? <p className="mt-2 text-sm text-slate-500">No source-backed findings.</p> : <ol className="mt-3 space-y-4">{item.findings.map((finding, index) => <li key={finding.id} className="break-inside-avoid rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-violet-800">{index + 1}. {finding.sourceCode} · {finding.severity} · {finding.status}</p><blockquote className="mt-2 border-l-2 border-amber-300 pl-3 text-sm italic">“{finding.quotedSpan}”</blockquote><p className="mt-2 text-sm">{finding.explanation}</p>{finding.suggestedFix && <p className="mt-2 text-sm text-emerald-800">Suggestion: {finding.suggestedFix}</p>}<p className="mt-2 text-[10px] text-slate-500">{Math.round(finding.confidence * 100)}% confidence · {finding.origin} · reviewed against version {finding.reviewedVersion}{finding.decidedBy ? ` · decision by ${finding.decidedBy.name}` : ''}{finding.decisionNote ? ` · note: ${finding.decisionNote}` : ''}</p></li>)}</ol>}</section>

          {visual && <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Visual brand check</h2><p className="mt-2 text-sm">{visual.summary}</p><p className="mt-1 text-xs text-slate-500">{visual.width} × {visual.height} · dominant colors {visual.dominantColors.join(', ')} · palette coverage {visual.paletteCoveragePercent === null ? 'not measured' : `${visual.paletteCoveragePercent}%`} · first palette color {visual.primaryColorCoveragePercent === null ? 'not measured' : `${visual.primaryColorCoveragePercent}%`} · provider {visual.provider} ({visual.model})</p><ul className="mt-3 space-y-3">{visual.findings.map((finding, index) => <li key={index} className="break-inside-avoid rounded-xl bg-violet-50 p-4"><p className="text-sm font-semibold">{finding.category} · {finding.severity}: {finding.title}</p><p className="mt-1 text-sm">{finding.evidence}</p><p className="mt-1 text-sm text-violet-900">Suggestion: {finding.recommendation}</p><p className="mt-1 text-[10px] text-slate-500">{Math.round(finding.confidence * 100)}% confidence</p></li>)}</ul></section>}

          {accessibility && <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Accessibility check</h2><p className="mt-2 text-sm">{accessibility.readingLevel}{accessibility.readingEase !== null ? ` (${accessibility.readingEase}/100)` : ''} · {accessibility.wordCount} words · {accessibility.averageWordsPerSentence} average words per sentence.</p><ul className="mt-3 space-y-2">{accessibility.issues.map((issue, index) => <li key={index} className="text-sm"><span className="font-semibold">{issue.category}:</span> {issue.message} {issue.recommendation}</li>)}</ul></section>}

          <section className="break-inside-avoid border-b border-slate-100 py-6"><h2 className="text-lg font-semibold">Manager notes ({item.comments.length})</h2>{item.comments.map((comment) => <p key={comment.id} className="mt-2 text-sm"><span className="font-semibold">{comment.author.name}:</span> {comment.body}</p>)}</section>

          <section className="break-inside-avoid py-6"><h2 className="text-lg font-semibold">AI and review disclosure</h2><p className="mt-2 text-sm leading-6 text-slate-600">AI-assisted suggestions are advisory. The team makes final decisions. Findings and comments remain attached to the review record.</p><ul className="mt-2 space-y-1 text-xs text-slate-500">{item.aiLogs.map((log) => <li key={log.id}>{log.provider} · {log.model} · {log.ok ? 'completed' : `not completed${log.error ? ` (${log.error})` : ''}`} · {log.createdAt.toLocaleString('en-IN')}</li>)}</ul></section>
        </article>
      </div>
    </main>
  )
}
