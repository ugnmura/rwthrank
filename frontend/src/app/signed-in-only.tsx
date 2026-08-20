'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { useAuthRecord } from '@/lib/auth'

/**
 * Sends visitors without a session to the login page.
 *
 * The site is a static export, so there is no server to redirect: the page ships
 * to everyone and the check runs after it loads. Nothing sensitive leaks by
 * that, because every screen behind this renders data it has to fetch with a
 * token first — there is nothing in the HTML to see.
 */
export function SignedInOnly({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useAuthRecord()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !user) router.replace('/login')
  }, [isPending, user, router])

  if (isPending || !user) return null

  return <>{children}</>
}
