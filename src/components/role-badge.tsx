import type { Role } from '@/lib/validation'

const roleStyles: Record<Role, string> = {
  SUPER_ADMIN: 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200',
  ADMIN: 'bg-violet-100 text-violet-700 ring-violet-200',
  MANAGER: 'bg-amber-100 text-amber-700 ring-amber-200',
  CREATOR: 'bg-sky-100 text-sky-700 ring-sky-200',
}

export function RoleBadge({ role }: { role: Role }) {
  const label = role === 'SUPER_ADMIN' ? 'Super Admin' : role[0] + role.slice(1).toLowerCase()
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${roleStyles[role]}`}
    >
      {label}
    </span>
  )
}
