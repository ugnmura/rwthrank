'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

/**
 * Where you are, and the way back up.
 *
 * Built from the path rather than passed in per page, so a new route cannot
 * forget to have one. The last crumb is the current page and is not a link.
 */
export function Breadcrumbs() {
  const t = useTranslations('nav')
  const path = usePathname()

  const segments = path.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
  if (segments.length === 0) return null

  const labels: Record<string, string> = {
    dashboard: t('dashboard'),
    compare: t('compare'),
    settings: t('settings'),
    legal: t('legal'),
    verify: t('verify'),
  }

  return (
    <nav className="breadcrumbs mx-auto w-full max-w-2xl px-6 pt-1.5 pb-0 text-xs text-base-content/60 sm:px-10">
      <ul>
        <li>
          <Link href="/" className="hover:text-base-content">rwthrank</Link>
        </li>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const label = labels[segment] ?? segment
          const last = index === segments.length - 1

          return (
            <li key={href}>
              {last ? (
                label
              ) : (
                <Link href={href} className="hover:text-base-content">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
