import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/app-shell'
import { SubmissionForm } from '@/components/submission-form'

export default async function NewSubmissionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <AppShell session={session} active="submissions">
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New submission</h1>
        <p className="mt-1 text-sm text-slate-500">
          State the channel and purpose, paste the draft, and the review runs immediately. Every
          finding will cite an approved source with the exact quoted text.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <SubmissionForm />
        </div>
      </main>
    </AppShell>
  )
}
