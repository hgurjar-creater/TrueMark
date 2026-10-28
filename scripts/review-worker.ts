import { db } from '@/lib/db'
import { claimNextReviewJob, processReviewJob, recoverStaleReviewJobs } from '@/lib/review/job-queue'

const POLL_MS = Number(process.env.REVIEW_WORKER_POLL_MS) || 900
let stopping = false

process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('[review-worker] Started; waiting for queued reviews.')
  let lastRecovery = 0
  while (!stopping) {
    try {
      if (Date.now() - lastRecovery > 30_000) {
        await recoverStaleReviewJobs()
        lastRecovery = Date.now()
      }
      const jobId = await claimNextReviewJob()
      if (!jobId) {
        await sleep(POLL_MS)
        continue
      }
      await processReviewJob(jobId)
    } catch (error) {
      console.error('[review-worker] Job processing error:', error instanceof Error ? error.message : 'Unknown error')
      await sleep(POLL_MS)
    }
  }
  await db.$disconnect()
  console.log('[review-worker] Stopped.')
}

main().catch(async (error) => {
  console.error('[review-worker] Fatal error:', error instanceof Error ? error.message : 'Unknown error')
  await db.$disconnect()
  process.exitCode = 1
})
