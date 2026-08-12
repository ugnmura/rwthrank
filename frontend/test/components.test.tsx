import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

let currentPath = '/dashboard'
const logout = mock(() => {})
let currentUser: { id: string; email: string } | null = { id: 'u1', email: 'me@example.com' }

mock.module('next/navigation', () => ({
  usePathname: () => currentPath,
  useRouter: () => ({ push: mock(() => {}), replace: mock(() => {}) }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module('next-intl', () => ({
  // Labels are not what these tests are about; the key is a stable stand-in.
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
  useLocale: () => 'de',
}))

mock.module('@/lib/auth', () => ({
  useAuthRecord: () => ({ data: currentUser, isPending: false }),
  useLogout: () => logout,
}))

const { Stat, StatGrid } = await import('@/app/stat-grid')
const { Breadcrumbs } = await import('@/app/breadcrumbs')
const { MobileMenu } = await import('@/app/mobile-menu')

afterEach(() => {
  cleanup()
  logout.mockClear()
  currentUser = { id: 'u1', email: 'me@example.com' }
})

describe('the figures', () => {
  test('a cell shows its label, value and hint', () => {
    render(<Stat label="Median" value="1,60" hint="die Note in der Mitte" />)

    expect(screen.getByText('Median')).toBeDefined()
    expect(screen.getByText('1,60')).toBeDefined()
    expect(screen.getByText('die Note in der Mitte')).toBeDefined()
  })

  test('only the accented cell is coloured, so one number leads', () => {
    const { container } = render(
      <StatGrid columns="four">
        <Stat label="a" value="1" hint="x" tone="accent" />
        <Stat label="b" value="2" hint="y" />
      </StatGrid>
    )

    expect(container.querySelectorAll('.text-secondary')).toHaveLength(1)
  })

  test('the grid never scrolls sideways: it wraps at two columns', () => {
    const { container } = render(
      <StatGrid columns="four">
        <Stat label="a" value="1" hint="x" />
      </StatGrid>
    )

    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toContain('grid-cols-2')
    expect(grid.className).not.toContain('overflow-x')
  })

  test('separators ride on the cells, so a half-empty row shows no block of colour', () => {
    const { container } = render(
      <StatGrid columns="three">
        <Stat label="a" value="1" hint="x" />
      </StatGrid>
    )

    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).not.toContain('gap-px')
    expect((grid.firstElementChild as HTMLElement).className).toContain('border-r')
  })
})

describe('the breadcrumbs', () => {
  test('the front page shows none', () => {
    currentPath = '/'
    const { container } = render(<Breadcrumbs />)
    expect(container.innerHTML).toBe('')
  })

  test('a nested page links its parents and states the current one', () => {
    currentPath = '/dashboard/compare'
    render(<Breadcrumbs />)

    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/dashboard'])
    // The last crumb is text: a link to the page you are on goes nowhere.
    expect(screen.getByText('compare')).toBeDefined()
  })
})

describe('the mobile menu', () => {
  test('every destination is a link, and settings sits under the dashboard', () => {
    currentPath = '/dashboard'
    render(<MobileMenu />)

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/dashboard', '/dashboard/compare', '/dashboard/settings'])
  })

  test('the page you are on is marked, and only that one', () => {
    currentPath = '/dashboard/compare'
    render(<MobileMenu />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'))
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute('href')).toBe('/dashboard/compare')
  })

  test('a trailing slash still marks the page you are on', () => {
    currentPath = '/dashboard/settings/'
    render(<MobileMenu />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'))
    expect(current[0].getAttribute('href')).toBe('/dashboard/settings')
  })

  test('signing out is a button and it signs out', () => {
    render(<MobileMenu />)

    fireEvent.click(screen.getByText('signOut'))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  test('signed out there is one way in and nothing else', () => {
    currentUser = null
    render(<MobileMenu />)

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/login'])
    expect(screen.queryByText('signOut')).toBeNull()
  })

  test('the address is never shown: it is not something to press', () => {
    render(<MobileMenu />)
    expect(screen.queryByText('me@example.com')).toBeNull()
  })

  test('the language you are reading is held down, the other is offered', () => {
    render(<MobileMenu />)

    const german = screen.getByText('Deutsch')
    const english = screen.getByText('English')
    expect(german.getAttribute('aria-pressed')).toBe('true')
    expect(english.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(english)
    expect(localStorage.getItem('rwthrank.locale')).toBe('en')
    localStorage.clear()
  })

  test('the panel is hidden once there is room for the real header', () => {
    const { container } = render(<MobileMenu />)
    expect((container.firstElementChild as HTMLElement).className).toContain('sm:hidden')
  })
})
