'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { useAuthRecord } from '@/lib/auth'
import { useRank, type Profile } from '@/lib/rank'
import { Dashboard } from './dashboard'
import { GradeCurve } from './grade-curve'
import Link from 'next/link'

import { LocaleSwitcher } from './locale-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { AuthButton } from './auth-button'
import { SubjectFilter } from './subject-filter'
import { ScopeFilter } from './scope-filter'
import { TranscriptList } from './transcript-list'
import { RegisterForm } from './register-form'
import { TranscriptUpload } from './transcript-upload'

export default function Home() {
  const t = useTranslations()
  const { data, isPending } = useAuthRecord()
  // The generated record type has no program or grade yet — see Profile.
  const user = data as Profile | null | undefined
  const [view, setView] = useState<'auto' | 'overall'>('auto')
  const rank = useRank(view)

  // /api/rank has the last word once it answers: nulls there mean an account
  // without a grade. Until then the record we just wrote stands in, so a slow or
  // unreachable endpoint never throws a ranked user back into the form.
  const ranked = rank.data ? rank.data.grade !== null : user?.grade != null
  const showDashboard = !!user && ranked
  const hasSubject = Boolean(user?.program && user?.degree)

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <span className="text-base-content/70">rwthrank</span>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <LocaleSwitcher />
          <AuthButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        {isPending ? (
          <div className="h-[104px]" aria-hidden />
        ) : showDashboard ? (
          <Dashboard view={view} />
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

      </main>

      {/* Below the ranking on purpose: the number is what the page is for, and
          the transcript is the way to correct it. */}
      {showDashboard && (
        <section className="mx-auto w-full max-w-2xl space-y-8 px-6 pb-12 sm:px-10">
          {/* Ask for the subject only while it is missing; once it is known the
              same space becomes the switch between that subject and everyone. */}
          {hasSubject ? (
            <ScopeFilter view={view} onChange={setView} program={user!.program!} />
          ) : (
            <SubjectFilter program={user?.program} degree={user?.degree} />
          )}

          <TranscriptList />

          <TranscriptUpload />
        </section>
      )}

      <footer className="w-full px-6 pb-8 sm:px-10">
        {/* Full-bleed on purpose: the distribution is the floor the landing page
            stands on. Once there is a real ranking it has nothing left to say. */}
        {!showDashboard && <GradeCurve />}
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

