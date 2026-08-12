'use client'

import { useSyncExternalStore } from 'react'

/**
 * Light, dark, or whatever the machine says.
 *
 * daisyUI keys off a data-theme attribute, and "system" means not setting it at
 * all so the prefersdark theme applies. Stored rather than held in state so the
 * choice survives a reload, and read through an external store so the static
 * prerender and the first client render agree on "system".
 */
const KEY = 'rwthrank.theme'

export type ThemeChoice = 'system' | 'rwth' | 'rwth-dark'

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'system' || value === 'rwth' || value === 'rwth-dark'
}

function getSnapshot(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY)
    return isChoice(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const getServerSnapshot = (): ThemeChoice => 'system'

export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', choice)
  }

  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private mode. The attribute is still set for this visit.
  }

  listeners.forEach((listener) => listener())
}

export function useThemeChoice() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
