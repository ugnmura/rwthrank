import { describe, expect, test } from 'bun:test'

import { crumbsFor } from '@/lib/trail'

const labels = {
  dashboard: 'Platzierung',
  compare: 'Vergleichen',
  settings: 'Einstellungen',
  legal: 'Impressum & Datenschutz',
  verify: 'Bestätigung',
}

describe('crumbsFor', () => {
  test('the front page has no trail of its own', () => {
    expect(crumbsFor('/', labels)).toEqual([])
    expect(crumbsFor('', labels)).toEqual([])
  })

  test('one level deep is a single crumb, and it is where you are', () => {
    expect(crumbsFor('/dashboard', labels)).toEqual([
      { href: '/dashboard', label: 'Platzierung', current: true },
    ])
  })

  test('a nested page keeps its parent as a link', () => {
    expect(crumbsFor('/dashboard/compare/', labels)).toEqual([
      { href: '/dashboard', label: 'Platzierung', current: false },
      { href: '/dashboard/compare', label: 'Vergleichen', current: true },
    ])
  })

  test('settings moved under the dashboard and the trail followed', () => {
    const trail = crumbsFor('/dashboard/settings/', labels)
    expect(trail.map((crumb) => crumb.href)).toEqual(['/dashboard', '/dashboard/settings'])
    expect(trail.at(-1)?.current).toBe(true)
  })

  test('trailing and repeated slashes do not invent empty crumbs', () => {
    expect(crumbsFor('//dashboard//', labels)).toEqual([
      { href: '/dashboard', label: 'Platzierung', current: true },
    ])
  })

  test('an untranslated segment falls back to itself rather than vanishing', () => {
    expect(crumbsFor('/dashboard/unknown', labels).at(-1)).toEqual({
      href: '/dashboard/unknown',
      label: 'unknown',
      current: true,
    })
  })

  test('exactly one crumb is ever the current page', () => {
    for (const path of ['/legal', '/dashboard/compare', '/dashboard/settings', '/verify']) {
      expect(crumbsFor(path, labels).filter((crumb) => crumb.current)).toHaveLength(1)
    }
  })

  test('every href is a prefix of the next, so no crumb leads sideways', () => {
    const trail = crumbsFor('/dashboard/compare', labels)
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].href.startsWith(trail[i - 1].href + '/')).toBe(true)
    }
  })
})
