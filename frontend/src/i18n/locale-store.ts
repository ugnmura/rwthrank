'use client'

import { useSyncExternalStore } from 'react'

import { defaultLocale, isLocale, LOCALE_STORAGE_KEY, type Locale } from './config'

/**
 * The chosen locale, read straight from local storage.
 *
 * Local storage is an external store, so it is subscribed to rather than copied
 * into state by an effect. That also gets the prerender right: the server
 * snapshot is the default locale, which is what the static HTML is built with,
 * and React swaps in the stored value after hydration without a mismatch.
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab changing the choice should move this one too.
  window.addEventListener('storage', listener)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function getSnapshot(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    return isLocale(stored) ? stored : defaultLocale
  } catch {
    return defaultLocale
  }
}

function getServerSnapshot(): Locale {
  return defaultLocale
}

export function useStoredLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Private mode. Nothing is persisted, and the listeners below still fire so
    // the choice applies for this visit.
  }
  listeners.forEach((listener) => listener())
}
