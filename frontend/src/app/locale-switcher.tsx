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
    <div className="flex items-center gap-2" aria-label={t('label')}>
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className="text-base-content/20">/</span>}
          <button
            type="button"
            lang={locale}
            disabled={pending || locale === active}
            aria-current={locale === active ? 'true' : undefined}
            onClick={() =>
              startTransition(async () => {
                await setUserLocale(locale)
                // The messages are resolved on the server, so the tree has to
                // be re-fetched rather than swapped client-side.
                router.refresh()
              })
            }
            className={
              locale === active
                ? 'text-base-content/70'
                : 'text-base-content/35 underline-offset-4 hover:text-base-content/70 hover:underline'
            }
          >
            {localeNames[locale]}
          </button>
        </span>
      ))}
    </div>
  )
}
