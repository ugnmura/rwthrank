'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'

import { applyTheme, useThemeChoice } from './theme-toggle'

/**
 * One button: sun when it is dark, moon when it is light.
 *
 * "System" stays the starting point but has no button of its own. Pressing this
 * is a deliberate override, and the icon shows what pressing it will do.
 */
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

  // With "system" the button follows what the machine is showing, so it always
  // offers the opposite of what is on screen.
  const systemPrefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches

  const isDark = choice === 'rwth-dark' || (choice === 'system' && systemPrefersDark)

  return (
    <button
      type="button"
      onClick={() => applyTheme(isDark ? 'rwth' : 'rwth-dark')}
      aria-label={isDark ? t('toLight') : t('toDark')}
      title={isDark ? t('toLight') : t('toDark')}
      className="flex items-center text-base-content/40 transition-colors hover:text-base-content/80"
    >
      {isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  )
}

