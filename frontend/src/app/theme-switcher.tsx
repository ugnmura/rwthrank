'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'

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
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
