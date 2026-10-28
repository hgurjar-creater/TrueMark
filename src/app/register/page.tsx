import Link from 'next/link'
import { db } from '@/lib/db'
import { Logo } from '@/components/logo'
import { RegisterForm } from '@/components/register-form'

export const dynamic = 'force-dynamic'

// The server checks whether the workspace already has an Admin, so this page
// always tells the truth: either the bootstrap form, or a closed notice.
export default async function RegisterPage() {
  const registrationOpen = (await db.user.count()) === 0 && Boolean(process.env.SUPER_ADMIN_SETUP_SECRET)

  return (
    <div className="min-h-screen">
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="TrueMark home"><Logo /></Link>
          <Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-violet-700">Sign in</Link>
        </div>
      </header>
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {registrationOpen ? (
            <RegisterForm />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-xl font-semibold text-slate-900">Registration is closed</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Super Admin setup is closed. Ask TrueMark for Super Admin access; brand Admins are
                created by the Super Admin, and Managers and Creators receive credentials from their Admin.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
