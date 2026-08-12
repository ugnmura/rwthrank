'use client'

import { useTranslations } from 'next-intl'

import { useAuthRecord, useLogout } from '@/lib/auth'
import { useRank, type Profile } from '@/lib/rank'
import { Dashboard } from './dashboard'
import { GradeCurve } from './grade-curve'
import Link from 'next/link'

import { LocaleSwitcher } from './locale-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { RegisterForm } from './register-form'
import { TranscriptUpload } from './transcript-upload'

export default function Home() {
  const t = useTranslations()
  const { data, isPending } = useAuthRecord()
  // The generated record type has no program or grade yet — see Profile.
  const user = data as Profile | null | undefined
  const rank = useRank()

  // /api/rank has the last word once it answers: nulls there mean an account
  // without a grade. Until then the record we just wrote stands in, so a slow or
  // unreachable endpoint never throws a ranked user back into the form.
  const ranked = rank.data ? rank.data.grade !== null : user?.grade != null
  const showDashboard = !!user && ranked

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <span className="text-base-content/70">rwthrank</span>
        <div className="flex items-baseline gap-4">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        {isPending ? (
          <div className="h-[104px]" aria-hidden />
        ) : showDashboard ? (
          <Dashboard />
        ) : (
          <>
            <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-base-content/35 uppercase">
              {t('header.tagline')}
            </p>
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-base-content/60">
              {user ? t('hero.subtitleSignedIn') : t('hero.subtitle')}
            </p>

            <div className="mt-8 max-w-sm">
              <RegisterForm signedInEmail={user?.email} />
            </div>
          </>
        )}

        {user && <SignedIn email={user.email} />}
      </main>

      {/* Below the ranking on purpose: the number is what the page is for, and
          the transcript is the way to correct it. */}
      {showDashboard && (
        <section className="mx-auto w-full max-w-2xl px-6 pb-12 sm:px-10">
          <TranscriptUpload />
        </section>
      )}

      {/* Full-bleed on purpose: the distribution is the floor the page stands on. */}
      <footer className="w-full px-6 pb-8 sm:px-10">
        <GradeCurve />
        <Link
          href="/legal"
          className="mt-6 inline-block font-mono text-[11px] tracking-[0.18em] text-base-content/40 uppercase underline-offset-4 hover:text-base-content/70 hover:underline"
        >
          {t('nav.legal')}
        </Link>
      </footer>
    </div>
  )
}

function SignedIn({ email }: { email: string }) {
  const t = useTranslations('signedIn')
  const logout = useLogout()

  return (
    <div className="mt-10 flex items-center gap-4 border-l-2 border-primary pl-4">
      <div className="min-w-0">
        <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
          {t('label')}
        </p>
        <p className="mt-1 font-medium break-all">{email}</p>
      </div>
      <button onClick={logout} className="btn btn-ghost btn-sm ml-auto">
        {t('signOut')}
      </button>
    </div>
  )
}
