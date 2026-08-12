'use client'

import { Suspense } from 'react'

import { CompareSection } from '../compare-section'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'

/**
 * The comparison on a page of its own, which is what a class on the dashboard
 * links to. The same section also sits under the dashboard, since it is part of
 * the same question.
 */
export default function ComparePage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
          {/* useSearchParams needs a boundary in a static export. */}
          <Suspense fallback={null}>
            <CompareSection />
          </Suspense>
        </main>
      </SignedInOnly>
    </div>
  )
}
