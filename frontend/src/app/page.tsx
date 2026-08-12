'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useAuthRecord } from '@/lib/auth'
import { useRank } from '@/lib/rank'
import { GradeCurve } from './grade-curve'
import { RegisterForm } from './register-form'
import { SiteHeader } from './site-header'

/**
 * The front page: what this is, and the form that gets you in.
 *
 * Anyone already signed in with a grade belongs on their dashboard, so this
 * hands them over rather than showing a second copy of it. Someone signed in
 * without a grade stays, because the form is what they still need.
 */
export default function Home() {
  const t = useTranslations()
  const { data: user, isPending } = useAuthRecord()
  const rank = useRank()
  const router = useRouter()

  const ranked = rank.data?.grade != null

  useEffect(() => {
    if (user && ranked) router.replace('/dashboard')
  }, [user, ranked, router])

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        {isPending ? (
          <div className="h-[104px]" aria-hidden />
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

      <footer className="w-full px-6 pb-8 sm:px-10">
        {/* Full-bleed on purpose: the distribution is the floor the landing page
            stands on. Once there is a real ranking it has nothing left to say. */}
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
