'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useAuthRecord } from '@/lib/auth'
import { AuthButton } from './auth-button'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeSwitcher } from './theme-switcher'

/**
 * The header every page shares, including the navigation between them.
 *
 * Each screen is its own address rather than a mode of one page, so the links
 * are real links: they can be bookmarked, opened in a tab, and reached with the
 * back button. The nav only appears once there is somewhere to go, which is
 * after signing in.
 */
export function SiteHeader() {
  const t = useTranslations('nav')
  const path = usePathname()
  const { data: user } = useAuthRecord()

  const links = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/dashboard/compare', label: t('compare') },
  ]

  return (
    <header className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/" className="text-base-content/70 hover:underline">
          rwthrank
        </Link>

        {user &&
          links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={path.replace(/\/$/, '') === link.href ? 'page' : undefined}
              className={
                path.replace(/\/$/, '') === link.href
                  ? 'text-base-content/70'
                  : 'text-base-content/35 underline-offset-4 hover:text-base-content/70 hover:underline'
              }
            >
              {link.label}
            </Link>
          ))}
      </div>

      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <LocaleSwitcher />
        <AuthButton />
      </div>
    </header>
  )
}
