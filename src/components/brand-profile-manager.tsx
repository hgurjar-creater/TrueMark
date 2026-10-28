'use client'

import { useEffect, useState, type FormEvent } from 'react'

interface BrandProfileInitial {
  name: string
  palette: string[]
  logoPreview: string | null
  logoFileName: string | null
}

export function BrandProfileManager({ initial }: { initial: BrandProfileInitial }) {
  const [name, setName] = useState(initial.name)
  const [palette, setPalette] = useState(initial.palette.join(', '))
  const [logo, setLogo] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!logo) { setLogoPreview(null); return }
    const url = URL.createObjectURL(logo)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logo])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const form = new FormData()
      form.set('name', name)
      form.set('palette', JSON.stringify(palette.split(/[\s,]+/).filter(Boolean)))
      if (logo) form.set('logo', logo)
      if (removeLogo) form.set('removeLogo', 'true')
      const response = await fetch('/api/admin/brand-profile', { method: 'PUT', body: form })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error ?? 'Could not save brand profile.')
      setNotice('Brand profile saved. New submissions will use these references.')
      setLogo(null)
      setRemoveLogo(false)
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save brand profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Visual identity</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Brand references</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Set the canonical logo and palette. Visual checks compare uploaded creatives against these references and explain where a reviewer should look.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Private to this workspace</span>
      </div>

      <form onSubmit={save} className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Brand name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Approved palette <span className="font-normal text-slate-400">(1–8 HEX colors)</span>
            <input value={palette} onChange={(event) => setPalette(event.target.value)} placeholder="#6D4AFF, #211D2D, #FFFFFF" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Palette preview">
            {palette.split(/[\s,]+/).filter((color) => /^#[0-9a-f]{6}$/i.test(color)).map((color) => (
              <span key={color} title={color} className="h-8 w-8 rounded-lg border border-slate-200 shadow-inner" style={{ backgroundColor: color }} />
            ))}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Approved logo reference
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setLogo(event.target.files?.[0] ?? null); setRemoveLogo(false) }} className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:font-semibold file:text-violet-700" />
            <span className="mt-1 block text-xs font-normal text-slate-400">PNG, JPEG or WebP, up to 3 MB. This reference is stored in the app database and served only to authenticated workspace users.</span>
          </label>
          {(initial.logoPreview || logo) && !removeLogo && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {/* Preview is a locally selected file or an authenticated API response. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreview ?? initial.logoPreview ?? undefined} alt="Approved brand logo preview" className="h-14 max-w-36 rounded bg-white object-contain p-1" />
              <div className="min-w-0 flex-1 text-xs text-slate-600">{logo?.name ?? initial.logoFileName ?? 'Current approved logo'}</div>
              {!logo && <button type="button" onClick={() => setRemoveLogo(true)} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between rounded-xl bg-violet-50/70 p-4 text-sm text-violet-950">
          <div>
            <p className="font-semibold">How the visual check works</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-violet-900/80">
              <li>Measures image dimensions and samples dominant colors locally.</li>
              <li>When Gemini is configured, compares the creative with the supplied logo and palette for visible mismatch, contrast, and proportions.</li>
              <li>Checks alternative text and keeps the result with the submission for creator and manager review.</li>
              <li>AI visual findings are suggestions; reviewers make the final call.</li>
            </ul>
          </div>
          <div className="mt-4 space-y-2">
            {error && <p role="alert" className="rounded-lg bg-white px-3 py-2 text-xs text-rose-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-white px-3 py-2 text-xs text-emerald-700">{notice}</p>}
            <button disabled={busy} className="rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-800 disabled:opacity-60">{busy ? 'Saving…' : 'Save brand references'}</button>
          </div>
        </div>
      </form>
    </section>
  )
}
