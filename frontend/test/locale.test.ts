import { afterEach, describe, expect, test } from 'bun:test'

import { defaultLocale, isLocale, locales, localeNames, LOCALE_STORAGE_KEY } from '@/i18n/config'
import { setStoredLocale } from '@/i18n/locale-store'

afterEach(() => {
  localStorage.clear()
})

describe('isLocale', () => {
  test('accepts the ones that exist', () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true)
  })

  test('rejects everything else, including things that look close', () => {
    for (const value of ['de-DE', 'DE', 'fr', '', null, undefined, 0, {}, ['de']]) {
      expect(isLocale(value)).toBe(false)
    }
  })
})

describe('the stored locale', () => {
  test('German is the default, because the readers are in Aachen', () => {
    expect(defaultLocale).toBe('de')
    expect(Object.keys(localeNames).sort()).toEqual([...locales].sort())
  })

  test('a choice is written under a namespaced key', () => {
    setStoredLocale('en')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
    expect(LOCALE_STORAGE_KEY.startsWith('rwthrank.')).toBe(true)
  })

  test('switching back overwrites rather than stacking', () => {
    setStoredLocale('en')
    setStoredLocale('de')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('de')
  })

  test('a locale nobody asked for is not trusted on the way out', () => {
    // Anyone can put anything in local storage from the console. What comes
    // back has to be one of ours or the default.
    localStorage.setItem(LOCALE_STORAGE_KEY, '<script>alert(1)</script>')
    expect(isLocale(localStorage.getItem(LOCALE_STORAGE_KEY))).toBe(false)
  })

  test('storage refusing to write is not an error the reader sees', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    expect(() => setStoredLocale('en')).not.toThrow()

    Storage.prototype.setItem = original
  })
})
