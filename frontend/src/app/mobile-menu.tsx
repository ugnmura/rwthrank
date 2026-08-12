'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  ChartBarIcon,
  Cog6ToothIcon,
  ScaleIcon,
} from '@heroicons/react/24/outline'

import { locales, localeNames } from '@/i18n/config'
import { setStoredLocale, useStoredLocale } from '@/i18n/locale-store'
import { useAuthRecord, useLogout } from '@/lib/auth'
import { ThemeSwitcher } from './theme-switcher'

/**
 * The header's controls behind one button, for narrow screens.
 *
 * Three separate controls across the top fit a phone only by wrapping onto a
 * second line, which pushes the page down and reads like a mistake. Collapsed,
 * the header stays one line at every width.
 *
 * Everything in the panel is something to press. Nothing is labelled and
 * nothing merely informs: two language names and a moon explain themselves, and
 * a heading above them would be furniture. Every row answers a touch — the
 * ground darkens under a finger and the press is visible on the way down, which
 * is the only feedback a phone can give without a cursor.
 */
export function MobileMenu() {
  const t = useTranslations('nav')
  const { data: user } = useAuthRecord()
  const logout = useLogout()
  const path = usePathname().replace(/\/$/, '')

  const pages = [
    { href: '/dashboard', label: t('dashboard'), Icon: ChartBarIcon },
    { href: '/dashboard/compare', label: t('compare'), Icon: ScaleIcon },
    { href: '/dashboard/settings', label: t('settings'), Icon: Cog6ToothIcon },
  ]

  return (
    <div className="dropdown dropdown-end sm:hidden">
      <div
        tabIndex={0}
        role="button"
        aria-label={t('menu')}
        className="flex items-center p-1 text-base-content/50 transition-colors hover:text-base-content/80 active:scale-90 active:text-base-content"
      >
        <Bars3Icon className="size-5" />
      </div>

      <div
        tabIndex={0}
        className="dropdown-content z-20 mt-2 w-56 border border-base-300 bg-base-100 p-1 shadow-lg"
      >
        {user ? (
          <>
            {pages.map(({ href, label, Icon }) => (
              <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={row(path === href)}>
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
            <button type="button" onClick={logout} className={`${row(false)} w-full text-left`}>
              <ArrowRightStartOnRectangleIcon className="size-4 shrink-0" />
              {t('signOut')}
            </button>
          </>
        ) : (
          <Link href="/login" className={row(false)}>
            <ArrowRightStartOnRectangleIcon className="size-4 shrink-0" />
            {t('signIn')}
          </Link>
        )}

        <div className="mt-1 flex items-center justify-between gap-2 border-t border-base-300 p-1 pt-2">
          <LocaleToggle />
          <span className="flex size-8 items-center justify-center transition-transform active:scale-90">
            <ThemeSwitcher />
          </span>
        </div>
      </div>
    </div>
  )
}

/** One pressable row: darkens on touch, dips on the press, marked when active. */
function row(current: boolean) {
  return [
    'flex items-center gap-3 px-3 py-2.5 text-sm normal-case tracking-normal',
    'transition-colors duration-75 active:bg-base-300',
    current
      ? 'bg-base-200 font-medium text-base-content'
      : 'text-base-content/70 hover:bg-base-200 hover:text-base-content',
  ].join(' ')
}

/**
 * The two languages as one control rather than a pair of links, so the one you
 * are reading is visibly held down and the other is obviously pressable.
 */
function LocaleToggle() {
  const active = useStoredLocale()
  const t = useTranslations('language')

  return (
    <div className="flex border border-base-300" role="group" aria-label={t('label')}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === active}
          onClick={() => setStoredLocale(locale)}
          className={`px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors duration-75 ${
            locale === active
              ? 'bg-base-content/85 text-base-100'
              : 'text-base-content/45 hover:bg-base-200 hover:text-base-content active:bg-base-300'
          }`}
        >
          {localeNames[locale]}
        </button>
      ))}
    </div>
  )
}
