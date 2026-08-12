'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import de from '../../messages/de.json'
import en from '../../messages/en.json'
import { defaultLocale, isLocale, LOCALE_STORAGE_KEY, type Locale } from '@/i18n/config'

// Both locales ship in the bundle. The site is a static export on GitHub Pages,
// so there is no server to pick one per request and nothing to fetch on demand.
const MESSAGES = { de, en }

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void }

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
})

export const useLocaleSwitcher = () => useContext(LocaleContext)

export function Providers({ children }: { children: ReactNode }) {
  // Created in state so each browser session gets one client.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: false },
          // A rejected code should surface immediately, not after retries.
          mutations: { retry: false },
        },
      })
  )

  // Starts at the default so the prerendered HTML and the first client render
  // agree; a stored choice is applied on mount instead of during it.
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) setLocale(stored)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const choose = (next: Locale) => {
    setLocale(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // Private mode. The choice still applies for this visit.
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale: choose }}>
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale]}
        timeZone="Europe/Berlin"
      >
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  )
}
