const statusStyles: Record<string, string> = {
  IN_REVIEW: 'bg-sky-100 text-sky-700',
  CHANGES_REQUESTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  PUBLISHED: 'bg-violet-100 text-violet-700',
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        statusStyles[status] ?? 'bg-slate-100 text-slate-700'
      }`}
    >
      {status.replace('_', ' ').toLowerCase()}
    </span>
  )
}
