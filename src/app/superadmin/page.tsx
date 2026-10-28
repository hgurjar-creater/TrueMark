import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { Logo } from '@/components/logo'
import { LogoutButton } from '@/components/logout-button'
import { RoleBadge } from '@/components/role-badge'
import { SuperAdminPortal } from '@/components/superadmin-portal'

export default async function SuperAdminPage() {
  const session = await getSession()
  if (!session) redirect('/login?role=SUPER_ADMIN')
  if (session.role !== 'SUPER_ADMIN') redirect(session.role === 'ADMIN' ? '/admin' : '/dashboard')
  const [brands, feedback] = await Promise.all([
    db.workspace.findMany({ orderBy: { createdAt: 'desc' }, include: { users: { where: { role: 'ADMIN' }, select: { name: true, email: true } }, _count: { select: { users: true, submissions: true } } } }),
    db.productFeedback.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { name: true, role: true } }, submission: { select: { title: true } }, workspace: { select: { name: true } } } }),
  ])
  const initialWorkspaces = brands.map((brand) => ({ id: brand.id, name: brand.name, createdAt: brand.createdAt.toISOString(), admins: brand.users, users: brand._count.users, submissions: brand._count.submissions }))
  const feedbackRows = feedback.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))

  return <div className="min-h-screen bg-slate-50">
    <header className="site-glass-nav border-b border-slate-200"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"><Link href="/"><Logo /></Link><div className="flex items-center gap-3"><span className="text-sm text-slate-600">{session.name}</span><RoleBadge role={session.role} /><LogoutButton /></div></div></header>
    <main className="mx-auto max-w-6xl space-y-7 px-6 py-10"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-fuchsia-700">Platform controls</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Super Admin portal</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Create isolated brand workspaces, issue an Admin account to each brand, and review product feedback across the platform.</p></div><SuperAdminPortal initialWorkspaces={initialWorkspaces} feedback={feedbackRows} /></main>
  </div>
}
