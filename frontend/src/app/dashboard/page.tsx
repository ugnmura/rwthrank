'use client'

import { Suspense, useState } from 'react'

import { useRank } from '@/lib/rank'
import { Dashboard } from '../dashboard'
import { ScopeFilter } from '../scope-filter'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'
import { TranscriptList } from '../transcript-list'
import { TranscriptUpload } from '../transcript-upload'
import { CompareSection } from '../compare-section'

/**
 * Everything you have, on one page: the rank, what it is measured against, the
 * transcripts behind it, and the way to add another.
 *
 * They stay together because picking which transcript is ranked is a choice
 * about the number above it. Splitting them apart put that control on a
 * different page from the thing it changed.
 */
export default function DashboardPage() {
  // Which transcript is being ranked; unset means the newest.
  const [picked, setPicked] = useState<string>()
  const [view, setView] = useState<'auto' | 'overall'>('auto')
  const rank = useRank(view, picked)

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
          <Dashboard view={view} transcript={picked} />

          <ScopeFilter
            view={view}
            onChange={setView}
            program={rank.data?.program}
            degree={rank.data?.degree}
          />

          <TranscriptList selected={rank.data?.transcript ?? undefined} onSelect={setPicked} />

          <TranscriptUpload />

          {/* Part of the same question, so it sits under the ranking rather
              than only on a page of its own. */}
          <Suspense fallback={null}>
            <CompareSection />
          </Suspense>
        </main>
      </SignedInOnly>
    </div>
  )
}
