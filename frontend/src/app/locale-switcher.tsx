'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { locales, localeNames, type Locale } from '@/i18n/config'
import { setUserLocale } from '@/i18n/locale'

export function LocaleSwitcher() {
  const active = useLocale() as Locale
  const t = useTranslations('language')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        aria-label={t('label')}
        className="btn btn-ghost btn-sm text-neutral-content"
      >
        {active.toUpperCase()}
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden fill="currentColor">
          <path d="M0 0h10L5 6z" />
        </svg>
      </div>
      <ul tabIndex={0} className="dropdown-content menu z-10 w-32 bg-base-100 p-0 shadow">
        {locales.map((locale) => (
          <li key={locale}>
            <button
              type="button"
              lang={locale}
              disabled={pending}
              className={locale === active ? 'menu-active' : undefined}
              onClick={() =>
                startTransition(async () => {
                  await setUserLocale(locale)
                  // Messages resolve on the server, so the tree is re-fetched
                  // rather than swapped client-side.
                  router.refresh()
                })
              }
            >
              {localeNames[locale]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
