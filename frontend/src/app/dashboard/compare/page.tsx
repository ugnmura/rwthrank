'use client'

import { Suspense } from 'react'

import { CompareSection } from '../../compare-section'
import { SignedInOnly } from '../../signed-in-only'
import { SiteHeader } from '../../site-header'

/**
 * The comparison, nested under the dashboard because it answers the same
 * question the rank does, with the filters made explicit.
 */
export default function DashboardComparePage() {
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
