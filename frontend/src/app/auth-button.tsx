'use client'

import { useTranslations } from 'next-intl'

import { useAuthRecord, useLogout } from '@/lib/auth'

/**
 * The header's account control.
 *
 * Signed out it says "sign in" and drops focus into the email field, because
 * signing in and registering are the same form: there is no separate login page
 * to send anyone to.
 */
export function AuthButton() {
  const t = useTranslations('nav')
  const { data: user, isPending } = useAuthRecord()
  const logout = useLogout()

  // Nothing during the first read, so the label never flips from one state to
  // the other in front of the reader.
  if (isPending) return <span className="w-16" aria-hidden />

  if (user) {
    return (
      <button
        type="button"
        onClick={logout}
        className="text-base-content/40 underline-offset-4 hover:text-base-content/80 hover:underline"
      >
        {t('signOut')}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        const email = document.querySelector<HTMLInputElement>('input[type="email"]')
        email?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        email?.focus({ preventScroll: true })
      }}
      className="text-base-content/70 underline-offset-4 hover:underline"
    >
      {t('signIn')}
    </button>
  )
}
