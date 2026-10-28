'use client'

export function PrintReportButton() {
  return <button onClick={() => window.print()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white print:hidden">Print / Save as PDF</button>
}
