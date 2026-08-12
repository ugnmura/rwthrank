'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { TranscriptList } from '../transcript-list'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'

export default function TranscriptsPage() {
  const t = useTranslations('nav')

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12 sm:px-10">
          <TranscriptList />
          <Link href="/upload" className="btn btn-primary self-start">
            {t('upload')}
          </Link>
        </main>
      </SignedInOnly>
    </div>
  )
}
