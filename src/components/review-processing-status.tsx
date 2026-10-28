'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ReviewProcessingStatus({ submissionId, initialStatus }: { submissionId: string; initialStatus: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialStatus === 'COMPLETED' || initialStatus === 'FAILED') return
    let active = true
    let refreshing = false
    let timer: number | undefined
    let delay = 2000
    const check = async () => {
      try {
        const response = await fetch(`/api/submissions/${submissionId}/review-status`, { cache: 'no-store' })
        if (!response.ok) {
          scheduleNext()
          return
        }
        const result = await response.json() as { status: string; error?: string | null }
        if (!active) return
        setStatus(result.status)
        setError(result.error ?? null)
        if (result.status === 'COMPLETED' && !refreshing) {
          refreshing = true
          router.refresh()
          return
        }
        if (result.status === 'FAILED') return
      } catch {
        // A transient poll failure should not interrupt the review screen.
      }
      scheduleNext()
    }
    const scheduleNext = () => {
      if (!active) return
      timer = window.setTimeout(check, delay)
      delay = Math.min(Math.round(delay * 1.5), 10_000)
    }
    void check()
    return () => {
      active = false
      if (timer) window.clearTimeout(timer)
    }
  }, [initialStatus, router, submissionId])

  if (status === 'COMPLETED') return null
  if (status === 'FAILED') {
    return (
      <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-900" role="status">
        <p className="font-semibold">The review could not be completed.</p>
        <p className="mt-1 text-rose-800">{error || 'The worker will retry if the issue is temporary. Refresh this page to check again.'}</p>
      </div>
    )
  }

  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-violet-200 bg-white/75 px-5 py-4 text-sm text-slate-700 shadow-sm backdrop-blur" role="status" aria-live="polite">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-200 border-t-violet-700" aria-hidden="true" />
      <span><strong className="font-semibold text-slate-900">{status === 'PROCESSING' ? 'Review in progress' : 'Review queued'}</strong> · Quick checks are ready; AI and visual checks are finishing in the background.</span>
    </div>
  )
}
