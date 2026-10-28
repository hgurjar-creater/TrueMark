import Link from 'next/link'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/logo'
import { LoginForm } from '@/components/login-form'

// The server decides whether the workspace still needs its bootstrap Admin, so
// the "Create it" link only appears while sign-up is genuinely open.
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { role?: string }
}) {
  const session = await getSession()
  if (session) redirect(session.role === 'SUPER_ADMIN' ? '/superadmin' : session.role === 'ADMIN' ? '/admin' : '/dashboard')

  const registrationOpen = (await db.user.count()) === 0 && Boolean(process.env.SUPER_ADMIN_SETUP_SECRET)

  return (
    <div className="min-h-screen">
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="TrueMark home"><Logo /></Link>
          <Link href="/" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">Back to home</Link>
        </div>
      </header>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <LoginForm registrationOpen={registrationOpen} requestedRole={searchParams?.role} />
        </div>
      </main>
    </div>
  )
}
