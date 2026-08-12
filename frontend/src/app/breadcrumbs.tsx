'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { crumbsFor } from '@/lib/trail'

/**
 * Where you are, and the way back up.
 *
 * Built from the path rather than passed in per page, so a new route cannot
 * forget to have one. The last crumb is the current page and is not a link.
 */
export function Breadcrumbs() {
  const t = useTranslations('nav')
  const path = usePathname()

  const crumbs = crumbsFor(path, {
    dashboard: t('dashboard'),
    compare: t('compare'),
    settings: t('settings'),
    legal: t('legal'),
    verify: t('verify'),
  })

  if (crumbs.length === 0) return null

  return (
    <nav className="breadcrumbs mx-auto w-full max-w-2xl px-6 pt-1.5 pb-0 text-xs text-base-content/60 sm:px-10">
      <ul>
        <li>
          <Link href="/" className="hover:text-base-content">rwthrank</Link>
        </li>
        {crumbs.map(({ href, label, current }) => (
          <li key={href}>
            {current ? (
              label
            ) : (
              <Link href={href} className="hover:text-base-content">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
