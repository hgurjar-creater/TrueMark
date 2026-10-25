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
  active?: 'submissions'
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <Link
              href="/submissions"
              className={
                active === 'submissions'
                  ? 'text-sm font-semibold text-slate-900'
                  : 'text-sm font-medium text-slate-600 hover:text-slate-900'
              }
            >
              Submissions
            </Link>
            {session.role === 'ADMIN' && (
              <Link href="/admin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Admin panel
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{session.name}</span>
            <RoleBadge role={session.role} />
            <LogoutButton />
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
