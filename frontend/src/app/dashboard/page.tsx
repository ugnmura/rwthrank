'use client'

import { useState } from 'react'

import { useRank } from '@/lib/rank'
import { Dashboard } from '../dashboard'
import { ScopeFilter } from '../scope-filter'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'

export default function DashboardPage() {
  // Which transcript is being ranked; unset means the newest.
  const [picked] = useState<string>()
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
        </main>
      </SignedInOnly>
    </div>
  )
}
