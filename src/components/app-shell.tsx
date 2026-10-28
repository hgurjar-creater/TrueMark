import Link from 'next/link'
import type { SessionUser } from '@/lib/session-token'
import { Logo } from './logo'
import { LogoutButton } from './logout-button'
import { RoleBadge } from './role-badge'

export function AppShell({
  session,
  active,
  children,
}: {
  session: SessionUser
  active?: 'dashboard' | 'submissions'
  children: React.ReactNode
}) {
  const navClass = (isActive: boolean) =>
    isActive
      ? 'rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800'
      : 'rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'

  return (
    <div className="min-h-screen">
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <Link
              href="/dashboard"
              className={navClass(active === 'dashboard')}
            >
              Overview
            </Link>
            <Link
              href="/submissions"
              className={navClass(active === 'submissions')}
            >
              Submissions
            </Link>
            {session.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Admin panel
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{session.name}</span>
            <RoleBadge role={session.role} />
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
