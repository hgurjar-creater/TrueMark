// Round 3 commitment 1 measurement: full-population citation validation.
// Runs the server-side citation audit (every retained finding re-verified
// against its approved source and the verbatim draft span) and saves the
// report. Uses the platform Super Admin to cover ALL workspaces.
//
// Start the app (npm run dev), then: node scripts/verify-citations.mjs
import { writeFile } from 'node:fs/promises'

const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const email = process.env.AUDIT_EMAIL ?? 'superadmin@truemark.test'
const password = process.env.AUDIT_PASSWORD ?? 'truemark1234'

async function main() {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok) throw new Error(`Super Admin login failed (${login.status}).`)
  const cookie = login.headers.getSetCookie?.()[0]?.split(';')[0]

  const response = await fetch(`${base}/api/admin/evaluation`, { headers: { cookie } })
  if (!response.ok) throw new Error(`Citation audit request failed (${response.status}).`)
  const body = await response.json()
  const audit = body.citationAudit

  await writeFile(new URL('../evaluation/citation-validation.json', import.meta.url), JSON.stringify(audit, null, 2))

  console.log(`Scope              : ${audit.scope}`)
  console.log(`Retained findings  : ${audit.totalFindings}`)
  console.log(`Valid citations    : ${audit.valid}`)
  console.log(`Citation validity  : ${audit.citationValidity === null ? 'no findings yet' : `${(audit.citationValidity * 100).toFixed(2)}%`} (target: 100%)`)
  console.log(`Invalid            : ${audit.invalid}`)
  for (const issue of audit.issues.slice(0, 10)) {
    console.log(`  - [${issue.reason}] ${issue.sourceCode} in "${issue.submissionTitle}" (${issue.status})`)
  }
  console.log('Saved to evaluation/citation-validation.json')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
