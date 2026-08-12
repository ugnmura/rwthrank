'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import de from '../../messages/de.json'
import en from '../../messages/en.json'
import { useStoredLocale } from '@/i18n/locale-store'

// Both locales ship in the bundle. The site is a static export on GitHub Pages,
// so there is no server to pick one per request and nothing to fetch on demand.
const MESSAGES = { de, en }

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

  const locale = useStoredLocale()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Europe/Berlin">
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  )
}
