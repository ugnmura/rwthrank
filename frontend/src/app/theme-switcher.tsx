'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

import { applyTheme, useThemeChoice, type ThemeChoice } from './theme-toggle'

const OPTIONS: { value: ThemeChoice; key: 'system' | 'light' | 'dark' }[] = [
  { value: 'system', key: 'system' },
  { value: 'rwthrank', key: 'light' },
  { value: 'rwthrank-dark', key: 'dark' },
]

export function ThemeSwitcher() {
  const choice = useThemeChoice()
  const t = useTranslations('theme')

  // The stored choice has to reach the document on first paint too, not only
  // when the button is pressed.
  useEffect(() => {
    const root = document.documentElement
    if (choice === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', choice)
  }, [choice])

  return (
    <div className="flex items-center gap-2" aria-label={t('label')}>
      {OPTIONS.map((option, index) => (
        <span key={option.value} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className="text-base-content/20">/</span>}
          <button
            type="button"
            disabled={option.value === choice}
            aria-current={option.value === choice ? 'true' : undefined}
            onClick={() => applyTheme(option.value)}
            className={
              option.value === choice
                ? 'text-base-content/70'
                : 'text-base-content/35 underline-offset-4 hover:text-base-content/70 hover:underline'
            }
          >
            {t(option.key)}
          </button>
        </span>
      ))}
    </div>
  )
}
