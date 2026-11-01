import Link from 'next/link'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { LoginForm } from '@/components/login-form'

// The server decides whether the workspace still needs its bootstrap Admin, so
// the "Create it" link only appears while sign-up is genuinely open.

// Per the event organisers, judge-facing demo credentials are shown on the
// sign-in page itself so the product can be tested without any setup.
const JUDGE_DEMO_ACCOUNTS: Record<string, { email: string; password: string } | null> = {
  SUPER_ADMIN: null,
  ADMIN: { email: 'judge-admin@truemark.test', password: 'JudgeAdmin-TM26!' },
  MANAGER: { email: 'judge-manager@truemark.test', password: 'JudgeManager-TM26!' },
  CREATOR: { email: 'judge-creator@truemark.test', password: 'JudgeCreator-TM26!' },
}

const LOCAL_DEMO_ACCOUNTS: Record<string, { email: string; password: string } | null> = {
  SUPER_ADMIN: { email: 'superadmin@truemark.test', password: 'truemark1234' },
  ADMIN: { email: 'admin@truemark.test', password: 'truemark1234' },
  MANAGER: { email: 'manager@truemark.test', password: 'truemark1234' },
  CREATOR: { email: 'creator@truemark.test', password: 'truemark1234' },
}

const ROLE_CARDS = [
  { role: 'SUPER_ADMIN', label: 'Super Admin', description: 'Create brand workspaces, provision brand Admins and review product feedback.' },
  { role: 'ADMIN', label: 'Admin', description: 'Manage one brand’s guidance and create its Manager or Creator accounts.' },
  { role: 'MANAGER', label: 'Manager', description: 'Review submissions, comment and approve publication.' },
  { role: 'CREATOR', label: 'Creator', description: 'Submit drafts and resolve source-backed findings.' },
] as const

const roleAccent: Record<string, string> = {
  SUPER_ADMIN: 'bg-fuchsia-100 text-fuchsia-700',
  ADMIN: 'bg-violet-100 text-violet-700',
  MANAGER: 'bg-amber-100 text-amber-700',
  CREATOR: 'bg-sky-100 text-sky-700',
}

function validRole(value: string | undefined): string | null {
  return value && ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CREATOR'].includes(value) ? value : null
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { role?: string; next?: string }
}) {
  const session = await getSession()
  if (session) redirect(session.role === 'SUPER_ADMIN' ? '/superadmin' : session.role === 'ADMIN' ? '/admin' : '/dashboard')

  const registrationOpen = (await db.user.count()) === 0 && Boolean(process.env.SUPER_ADMIN_SETUP_SECRET)

  const isProduction = process.env.NODE_ENV === 'production'
  const demoAccounts = isProduction ? JUDGE_DEMO_ACCOUNTS : LOCAL_DEMO_ACCOUNTS
  const nextParam = searchParams?.next && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') ? searchParams.next : null

  return (
    <div className="min-h-screen">
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="TrueMark home"><Logo /></Link>
          <Link href="/" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">Back to home</Link>
        </div>
      </header>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        {(() => {
          const role = validRole(searchParams?.role)
          if (role) {
            return (
              <div className="w-full max-w-md">
                <LoginForm registrationOpen={registrationOpen} requestedRole={role} demoAccount={demoAccounts[role] ?? null} />
              </div>
            )
          }
          return (
            <div className="w-full max-w-4xl">
              <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Choose your portal</h1>
              <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-6 text-slate-500">
                Pick the window that matches your role, then sign in. Each window only accepts that
                role&rsquo;s credentials.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {ROLE_CARDS.map((card) => (
                  <Link
                    key={card.role}
                    href={`/login?role=${card.role}${nextParam ? `&next=${encodeURIComponent(nextParam)}` : ''}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md"
                  >
                    <span className={`grid h-10 w-10 place-items-center rounded-2xl text-xs font-bold ${roleAccent[card.role]}`}>
                      {card.label.slice(0, 2).toUpperCase()}
                    </span>
                    <h2 className="mt-4 text-base font-semibold text-slate-900">{card.label}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{card.description}</p>
                    <span className="mt-3 inline-flex text-xs font-semibold text-violet-700">Continue to {card.label} sign in →</span>
                  </Link>
                ))}
              </div>
              <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-xs leading-5 text-violet-900">
                <p className="font-semibold">Demo accounts for testing</p>
                <ul className="mt-2 space-y-1">
                  {ROLE_CARDS.map((card) => {
                    const account = demoAccounts[card.role]
                    return (
                      <li key={card.role}>
                        {account ? (
                          <>
                            <span className="font-semibold">{card.label}:</span>{' '}
                            <span className="font-mono">{account.email}</span>{' '}
                            / <span className="font-mono">{account.password}</span>
                          </>
                        ) : (
                          <span className="text-violet-700/70">{card.label}: contact TrueMark for Super Admin access.</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-violet-700/80">
                  Public demo — click a portal above, then use these credentials (or the fill button on the form). Do not enter confidential or real customer information.
                </p>
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}
