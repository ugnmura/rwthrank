'use client'

import { useTranslations } from 'next-intl'

import { locales, localeNames } from '@/i18n/config'
import { useLocaleSwitcher } from './providers'

export function LocaleSwitcher() {
  const { locale: active, setLocale } = useLocaleSwitcher()
  const t = useTranslations('language')

  return (
    <div className="flex items-center gap-2" aria-label={t('label')}>
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className="text-base-content/20">/</span>}
          <button
            type="button"
            lang={locale}
            disabled={locale === active}
            aria-current={locale === active ? 'true' : undefined}
            onClick={() => setLocale(locale)}
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
