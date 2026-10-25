import { diffWords } from 'diff'

// Word-level comparison between two versions. Rendered on the server — the
// diff package runs in the Node runtime, and the result is plain markup.
export function DiffView({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const parts = diffWords(oldContent, newContent)
  return (
    <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
      {parts.map((part, index) =>
        part.added ? (
          <ins key={index} className="rounded-sm bg-emerald-100 text-emerald-800 no-underline">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={index} className="rounded-sm bg-red-100 text-red-700 no-underline">
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  )
}
