import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Logo } from '@/components/logo'

const features = [
  {
    title: 'Approved sources only',
    body: 'Every finding points to a rule, fact or term your administrator approved, together with the exact quoted span that triggered it. Findings without a verified source are discarded.',
  },
  {
    title: 'Human control',
    body: 'TrueMark suggests; people decide. You accept, edit or dismiss each finding with a reason, and nothing is rewritten or published automatically.',
  },
  {
    title: 'Learning over time',
    body: 'Reviewer decisions reveal which guidelines are unclear enough to keep causing problems, so the guidelines themselves improve.',
  },
]

export default async function Home() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-20 text-center">
        <p className="mx-auto mb-4 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Prepublication brand governance
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Catch off-brand content before the public sees it
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-600">
          TrueMark reviews drafts against your approved rules, facts and terms while there is still
          time to fix them. Each issue is explained, linked to its source, and paired with a change
          that keeps what you meant to say.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            Start reviewing
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-6 text-center text-xs leading-relaxed text-slate-500">
          Transparency: automated reviews may use AI assistance (Google Gemini). Every AI call is
          logged, findings without a verified approved source are discarded, and reviewer decisions
          always take precedence over AI suggestions.
        </div>
      </footer>
    </main>
  )
}
