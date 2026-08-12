'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
 * the header stays one line at every width.
 *
 * Nothing in the panel is labelled: two language names and a moon are their own
 * explanation, and a row saying "Language" above them is furniture.
 */
export function MobileMenu() {
  const t = useTranslations('nav')
  const { data: user } = useAuthRecord()
  const logout = useLogout()
  const path = usePathname().replace(/\/$/, '')

  const row = 'px-4 py-2.5 text-sm normal-case tracking-normal transition-colors'

  return (
    <div className="dropdown dropdown-end sm:hidden">
      <div
        tabIndex={0}
        role="button"
        aria-label={t('menu')}
        className="flex items-center p-1 text-base-content/50 transition-colors hover:text-base-content/80"
      >
        <Bars3Icon className="size-5" />
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-20 mt-2 w-56 border border-base-300 bg-base-100 shadow-lg"
      >
        {user ? (
          <>
            <p className="border-b border-base-300 px-4 py-2.5 text-xs break-all text-base-content/40 normal-case tracking-normal">
              {user.email}
            </p>
            <nav className="flex flex-col py-1">
              {[
                { href: '/dashboard', label: t('dashboard') },
                { href: '/dashboard/compare', label: t('compare') },
                { href: '/settings', label: t('settings') },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={path === link.href ? 'page' : undefined}
                  className={`${row} ${
                    path === link.href
                      ? 'bg-base-200 font-medium text-base-content'
                      : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={logout}
                className={`${row} text-left text-base-content/70 hover:bg-base-200 hover:text-base-content`}
              >
                {t('signOut')}
              </button>
            </nav>
          </>
        ) : (
          <nav className="flex flex-col py-1">
            <Link
              href="/login"
              className={`${row} text-base-content/70 hover:bg-base-200 hover:text-base-content`}
            >
              {t('signIn')}
            </Link>
          </nav>
        )}

        <div className="flex items-center justify-between border-t border-base-300 px-4 py-2.5">
          <LocaleSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </div>
  )
}
