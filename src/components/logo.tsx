export function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-900">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={large ? 'h-8 w-8 text-indigo-600' : 'h-6 w-6 text-indigo-600'}
        aria-hidden="true"
      >
        <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4.5" />
      </svg>
      <span className={large ? 'text-2xl font-bold tracking-tight' : 'text-lg font-semibold tracking-tight'}>
        TrueMark
      </span>
    </span>
  )
}
