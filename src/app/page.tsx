import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { Logo } from '@/components/logo'
import { PolygonSpotlight } from '@/components/polygon-spotlight'

const features = [
  {
    number: '01',
    title: 'Grounded in your standards',
    body: 'Reviews use the rules, facts and terms your team has approved. Each finding shows exactly where its guidance came from.',
  },
  {
    number: '02',
    title: 'Clear, usable feedback',
    body: 'See the quoted text, why it was flagged and a suggested change. Keep your intent while bringing the draft back on brand.',
  },
  {
    number: '03',
    title: 'People stay in control',
    body: 'Accept, edit or dismiss findings with a reason. A reviewer makes the final call before anything is ready to publish.',
  },
]

const portals = [
  { role: 'SUPER_ADMIN', label: 'Super Admin', description: 'Create brand workspaces, provision brand Admins and review product feedback.', access: 'Contact TrueMark for Super Admin credentials', accent: 'bg-fuchsia-100 text-fuchsia-700' },
  { role: 'ADMIN', label: 'Admin', description: 'Manage one brand’s guidance and create its Manager or Creator accounts.', access: 'Request credentials from TrueMark or your Super Admin', accent: 'bg-violet-100 text-violet-700' },
  { role: 'MANAGER', label: 'Manager', description: 'Review submissions, comment and approve publication.', access: 'Request credentials from your Admin', accent: 'bg-amber-100 text-amber-700' },
  { role: 'CREATOR', label: 'Creator', description: 'Submit drafts and resolve source-backed findings.', access: 'Request credentials from your Admin', accent: 'bg-sky-100 text-sky-700' },
] as const

const homeByRole = { SUPER_ADMIN: '/superadmin', ADMIN: '/admin', MANAGER: '/dashboard', CREATOR: '/dashboard' } as const

function ReviewPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[590px] px-3 pb-10 pt-6 sm:px-8 sm:pb-14">
      <div className="hero-glow absolute inset-0 rounded-[48%]" aria-hidden="true" />
      <div className="float-slow relative z-10 mx-auto w-[76%] rounded-[26px] border border-white/90 bg-white/90 p-5 shadow-[0_28px_90px_rgba(73,53,136,0.17)] backdrop-blur sm:p-7">
        <div className="flex items-center justify-between border-b border-violet-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 3 19 6v5c0 4.2-2.8 7.7-7 10-4.2-2.3-7-5.8-7-10V6l7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-900">Draft review</p>
              <p className="text-[10px] text-slate-400">LinkedIn · version 1</p>
            </div>
          </div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">3 findings</span>
        </div>

        <div className="space-y-3 py-5">
          <p className="text-[11px] leading-5 text-slate-500 sm:text-xs">
            We built the <span className="rounded bg-rose-100 px-1 text-rose-700">best</span> way for every team to stay on brand.
          </p>
          <div className="rounded-2xl border border-violet-100 bg-[#fbfaff] p-3.5 sm:p-4">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">R</span>
              <span className="text-[10px] font-semibold text-slate-800 sm:text-[11px]">Avoid unsupported superlatives</span>
              <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold uppercase text-rose-600">High</span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500 sm:text-[11px]">“Best” is a comparative claim. Add evidence or choose a specific benefit.</p>
            <div className="mt-3 flex items-center justify-between border-t border-violet-100 pt-2.5">
              <span className="font-mono text-[9px] font-semibold text-violet-600">R-004 · approved rule</span>
              <span className="text-[9px] font-semibold text-violet-700">View source ↗</span>
            </div>
          </div>
          <div className="h-2 w-[82%] rounded-full bg-slate-100" />
          <div className="h-2 w-[58%] rounded-full bg-slate-100" />
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[10px] text-slate-400">Your words. Your decision.</span>
          <span className="rounded-full bg-[#241f30] px-3 py-1.5 text-[9px] font-semibold text-white">Review finding</span>
        </div>
      </div>

      <div className="float-delayed absolute right-0 top-[-6%] z-20 hidden rounded-2xl border border-white bg-white/95 p-3 shadow-[0_16px_45px_rgba(73,53,136,0.14)] sm:block">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
          </span>
          <div><p className="text-[10px] font-semibold text-slate-800">Source verified</p><p className="text-[9px] text-slate-400">Approved library</p></div>
        </div>
      </div>

      <div className="absolute bottom-[5%] left-0 z-20 hidden rounded-2xl border border-white bg-white/95 p-3.5 shadow-[0_16px_45px_rgba(73,53,136,0.14)] sm:block">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-100 text-violet-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 18V6m0 12h16M8 14l3-4 3 2 5-6" /></svg>
          </span>
          <div><p className="text-[10px] font-semibold text-slate-800">Every change has a trail</p><p className="text-[9px] text-slate-400">Versioned and reviewable</p></div>
        </div>
      </div>
      <div className="scan-line absolute left-[48%] top-[2%] z-0 h-3 w-3 rounded-full border border-violet-300 bg-white shadow-[0_0_0_7px_rgba(197,179,255,.18)]" aria-hidden="true" />
    </div>
  )
}

export default async function Home() {
  const session = await getSession()
  if (session) redirect(homeByRole[session.role])

  // The first sign-up becomes the Admin; afterwards the Admin invites everyone.
  const registrationOpen = (await db.user.count()) === 0 && Boolean(process.env.SUPER_ADMIN_SETUP_SECRET)

  return (
    <main className="relative min-h-screen overflow-x-clip">
      <PolygonSpotlight />
      <header className="site-glass-nav border-b border-slate-200">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="TrueMark home"><Logo /></Link>
          <nav className="flex items-center gap-2 sm:gap-5" aria-label="Main navigation">
            <a href="#how-it-works" className="hidden text-sm font-medium text-slate-600 transition hover:text-violet-700 sm:inline">How it works</a>
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-violet-50">Sign in</Link>
            {registrationOpen ? (
              <Link href="/register" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/10 transition hover:-translate-y-0.5">Sign up</Link>
            ) : (
              <a href="#portals" className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/10 transition hover:-translate-y-0.5">Choose a portal</a>
            )}
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[650px] w-full max-w-7xl items-center gap-2 px-5 pb-12 pt-10 sm:px-8 lg:min-h-[690px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-0 lg:py-10">
        <div className="relative z-10 mx-auto max-w-xl lg:mx-0">
          <h1 className="max-w-[650px] text-balance text-[2.7rem] font-semibold leading-[1.04] tracking-[-0.055em] text-[#1b1824] sm:text-6xl lg:text-[4.4rem]">
            Keep every draft <span className="relative inline-block text-violet-600">true to you.<span className="absolute -bottom-1 left-0 h-[7px] w-full rounded-full bg-violet-200/70" /></span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Check content against your team’s approved rules, facts and terms. See the source behind every flag, make the edits that feel right, and send a clear review record forward.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {registrationOpen ? (
              <Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/15 transition hover:-translate-y-0.5 hover:shadow-violet-900/20">
                Create the admin account <span className="transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </Link>
            ) : (
              <Link href="/login?role=CREATOR" className="group inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/15 transition hover:-translate-y-0.5 hover:shadow-violet-900/20">
                Creator sign in <span className="transition group-hover:translate-x-0.5" aria-hidden="true">→</span>
              </Link>
            )}
            <a href="#portals" className="rounded-full border border-slate-300/80 bg-white/70 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-white">All four portals</a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="text-violet-600">✓</span> Approved sources</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-violet-600">✓</span> Human decisions</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-violet-600">✓</span> Full version history</span>
          </div>
        </div>
        <div className="relative -mx-3 mt-4 sm:mx-0 lg:mt-0">
          <ReviewPreview />
        </div>
      </section>

      <section id="portals" className="relative z-10 mx-auto w-full max-w-7xl scroll-mt-24 px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">Workspace access</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Choose your portal</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">
            {registrationOpen
              ? 'The first sign-up on a new installation becomes Super Admin. Super Admin creates each brand and assigns its Admin.'
              : 'Super Admin provisions brand Admins. Each brand Admin creates accounts for that brand’s Managers and Creators.'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {portals.map((portal, index) => (
            <article key={portal.role} data-role={portal.role.toLowerCase()} className="portal-glass-card group relative isolate overflow-hidden rounded-[24px] border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(50,38,89,.14)]">
              <span className={`grid h-10 w-10 place-items-center rounded-2xl text-xs font-bold ${portal.accent}`}>0{index + 1}</span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{portal.label}</h3>
              <p className="mt-1 min-h-12 text-xs leading-5 text-slate-600">{portal.description}</p>
              <p className="mt-3 text-[10px] font-medium text-slate-400">{portal.access}</p>
              <Link href={`/login?role=${portal.role}`} className="mt-4 inline-flex rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Sign in as {portal.label}</Link>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-20 pt-10 sm:px-8 sm:pb-28">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">A calmer way to review</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Good governance should feel clear.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-500">From first draft to final sign-off, TrueMark keeps people and evidence at the center.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.number} className="group rounded-[24px] border border-white/90 bg-white/80 p-6 shadow-[0_15px_45px_rgba(50,38,89,.06)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(50,38,89,.1)] sm:p-7">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-xs font-bold text-violet-700 transition group-hover:bg-violet-600 group-hover:text-white">{feature.number}</span>
              <h3 className="mt-6 text-base font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-slate-200/80 bg-white/65">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-6 text-xs leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p className="max-w-2xl">AI reviews are logged. Findings without an approved source and a matching quote are discarded. People always make the final decision.</p>
        </div>
      </footer>
    </main>
  )
}
