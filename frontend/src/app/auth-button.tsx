'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { useAuthRecord, useLogout } from '@/lib/auth'

/**
 * The header's account control.
 *
 * Signed out it says "sign in" and drops focus into the email field, because
 * signing in and registering are the same form: there is no separate login page
 * to send anyone to. Signed in it is a menu, which keeps signing out and
 * deleting an account one step further away than anything else in the header.
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
      <div className="dropdown dropdown-end">
        <div
          tabIndex={0}
          role="button"
          className="text-base-content/70 underline-offset-4 hover:underline"
        >
          {t('account')}
        </div>
        <ul
          tabIndex={0}
          className="dropdown-content menu z-10 w-56 border border-base-300 bg-base-100 p-2 normal-case shadow"
        >
          <li className="menu-title px-3 py-1 text-xs break-all normal-case">{user.email}</li>
          <li>
            <Link href="/dashboard">{t('dashboard')}</Link>
          </li>
          <li>
            <Link href="/dashboard/compare">{t('compare')}</Link>
          </li>
          <li>
            <Link href="/settings">{t('settings')}</Link>
          </li>
          <li>
            <button type="button" onClick={logout}>
              {t('signOut')}
            </button>
          </li>
        </ul>
      </div>
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
