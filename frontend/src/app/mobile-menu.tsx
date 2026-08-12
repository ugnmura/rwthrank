'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bars3Icon } from '@heroicons/react/24/outline'

import { useAuthRecord, useLogout } from '@/lib/auth'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeSwitcher } from './theme-switcher'

/**
 * The header's controls behind one button, for narrow screens.
 *
 * Three separate controls across the top fit a phone only by wrapping onto a
 * second line, which pushes the page down and reads like a mistake. Collapsed,
 * the header stays one line at every width, and the things that were on it are
 * a tap away in the order they are needed: where to go, then how it looks.
 */
export function MobileMenu() {
  const t = useTranslations('nav')
  const theme = useTranslations('theme')
  const language = useTranslations('language')
  const { data: user } = useAuthRecord()
  const logout = useLogout()

  return (
    <div className="dropdown dropdown-end sm:hidden">
      <div
        tabIndex={0}
        role="button"
        aria-label={t('menu')}
        className="flex items-center text-base-content/50 transition-colors hover:text-base-content/80"
      >
        <Bars3Icon className="size-5" />
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-20 w-60 border border-base-300 bg-base-100 py-2 normal-case shadow"
      >
        <ul className="menu w-full p-0">
          {user ? (
            <>
              <li className="menu-title px-4 py-1 text-xs break-all normal-case">{user.email}</li>
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
            </>
          ) : (
            <li>
              <Link href="/login">{t('signIn')}</Link>
            </li>
          )}
        </ul>

        {/* Outside the menu list on purpose: these two are settings, not places
            to go, and menu styling would give them the hover of a link. */}
        <div className="mt-2 space-y-2 border-t border-base-300 px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-base-content/60">{language('label')}</span>
            <span className="font-mono text-[11px] tracking-[0.18em] uppercase">
              <LocaleSwitcher />
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-base-content/60">{theme('label')}</span>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  )
}
