import { afterEach, describe, expect, test } from 'bun:test'

import { applyTheme } from '@/app/theme-toggle'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('applyTheme', () => {
  test('a chosen theme lands on the document, which is what daisyUI reads', () => {
    applyTheme('rwth-dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('rwth-dark')

    applyTheme('rwth')
    expect(document.documentElement.getAttribute('data-theme')).toBe('rwth')
  })

  test('"system" removes the attribute rather than naming a theme', () => {
    applyTheme('rwth-dark')
    applyTheme('system')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  test('the names match the themes the stylesheet defines', () => {
    // A toggle that stores "rwthrank-dark" while the CSS declares "rwth-dark"
    // silently does nothing. That has happened once already.
    applyTheme('rwth-dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('rwth-dark')
    expect(localStorage.getItem('rwthrank.theme')).toBe('rwth-dark')
  })

  test('the choice survives a reload', () => {
    applyTheme('rwth')
    expect(localStorage.getItem('rwthrank.theme')).toBe('rwth')
  })

  test('private mode still themes the page, it just does not remember', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('SecurityError')
    }

    expect(() => applyTheme('rwth-dark')).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('rwth-dark')

    Storage.prototype.setItem = original
  })
})
