export const locales = ['de', 'en'] as const

export type Locale = (typeof locales)[number]

// German first: the people reading a Notenspiegel are studying in Aachen.
export const defaultLocale: Locale = 'de'

export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  en: 'English',
}

export const LOCALE_COOKIE = 'locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale)
}
