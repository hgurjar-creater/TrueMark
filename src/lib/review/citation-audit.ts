import { db } from '@/lib/db'

// Round 3 commitment 1: report citation validity and exact-span verification
// for EVERY retained finding in a workspace (or all workspaces), not just the
// labelled demo set. A finding passes only when its approved source still
// exists, that source is approved, and the quoted span appears verbatim in the
// draft version the finding was recorded against.

export interface CitationIssue {
  findingId: string
  submissionId: string
  submissionTitle: string
  sourceCode: string
  status: string
  reason:
    | 'SOURCE_MISSING'
    | 'SOURCE_NOT_APPROVED'
    | 'VERSION_MISSING'
    | 'SPAN_NOT_VERBATIM'
    | 'SPAN_OFFSET_MISMATCH'
}

export interface CitationAuditResult {
  scope: string
  totalFindings: number
  valid: number
  invalid: number
  citationValidity: number | null
  byStatus: Record<string, { total: number; valid: number }>
  issues: CitationIssue[]
  generatedAt: string
}

export async function auditCitations(workspaceId?: string | null): Promise<CitationAuditResult> {
  const findings = await db.finding.findMany({
    where: workspaceId ? { submission: { is: { workspaceId } } } : {},
    include: {
      rule: true,
      fact: true,
      term: true,
      submission: {
        select: { id: true, title: true, workspaceId: true, versions: { orderBy: { versionNumber: 'asc' } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const issues: CitationIssue[] = []
  const byStatus: Record<string, { total: number; valid: number }> = {}
  let valid = 0

  for (const finding of findings) {
    const statusBucket = (byStatus[finding.status] ??= { total: 0, valid: 0 })
    statusBucket.total += 1

    const fail = (reason: CitationIssue['reason']) => {
      issues.push({
        findingId: finding.id,
        submissionId: finding.submissionId,
        submissionTitle: finding.submission.title,
        sourceCode: finding.sourceCode,
        status: finding.status,
        reason,
      })
    }

    const source = finding.rule ?? finding.fact ?? finding.term
    if (!source) {
      fail('SOURCE_MISSING')
      continue
    }
    if (source.approved !== true) {
      fail('SOURCE_NOT_APPROVED')
      continue
    }

    const version = finding.submission.versions.find((item) => item.versionNumber === finding.reviewedVersion)
    if (!version) {
      fail('VERSION_MISSING')
      continue
    }

    // Apply exactly the verifier's rule: when the finding recorded offsets,
    // the span must match at those offsets (the same word can appear many
    // times in a draft — indexOf alone would wrongly flag later occurrences).
    if (finding.spanStart !== null && finding.spanEnd !== null) {
      if (version.content.slice(finding.spanStart, finding.spanEnd) === finding.quotedSpan) {
        valid += 1
        statusBucket.valid += 1
        continue
      }
      fail(version.content.includes(finding.quotedSpan) ? 'SPAN_OFFSET_MISMATCH' : 'SPAN_NOT_VERBATIM')
      continue
    }

    if (!version.content.includes(finding.quotedSpan)) {
      fail('SPAN_NOT_VERBATIM')
      continue
    }

    valid += 1
    statusBucket.valid += 1
  }

  return {
    scope: workspaceId ?? 'ALL_WORKSPACES',
    totalFindings: findings.length,
    valid,
    invalid: issues.length,
    citationValidity: findings.length ? Number((valid / findings.length).toFixed(4)) : null,
    byStatus,
    issues,
    generatedAt: new Date().toISOString(),
  }
}
