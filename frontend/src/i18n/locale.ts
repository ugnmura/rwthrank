'use server'

import { cookies } from 'next/headers'

import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config'

/**
 * The chosen locale lives in a cookie rather than the URL.
 *
 * This is a single signed-in surface, not a public site that needs /de and /en
 * indexed separately, so locale-prefixed routes would add a proxy hop and a
 * routing layer for no gain.
 */
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value

  return isLocale(value) ? value : defaultLocale
}

export async function setUserLocale(locale: Locale): Promise<void> {
  const store = await cookies()

  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
