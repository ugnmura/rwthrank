import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

import { pb } from '@/lib/pocketbase'

let currentPath = '/dashboard'
const replace = mock(() => {})
let queryClient: QueryClient

type User = {
  id: string
  email: string
  collectionId: string
  collectionName: string
}

mock.module('next/navigation', () => ({
  usePathname: () => currentPath,
  useRouter: () => ({ push: mock(() => {}), replace }),
  useSearchParams: () => new URLSearchParams(),
}))

mock.module('next-intl', () => ({
  // Labels are not what these tests are about; the key is a stable stand-in.
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
  useLocale: () => 'de',
}))

const { Stat, StatGrid } = await import('@/app/stat-grid')
const { Breadcrumbs } = await import('@/app/breadcrumbs')
const { MobileMenu } = await import('@/app/mobile-menu')
const { SignedInOnly } = await import('@/app/signed-in-only')

beforeEach(() => {
  currentPath = '/dashboard'
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  setUser({
    id: 'u1',
    email: 'me@example.com',
    collectionId: 'users',
    collectionName: 'users',
  })
})

afterEach(() => {
  cleanup()
  pb.authStore.clear()
  replace.mockClear()
})

function setUser(user: User | null) {
  if (user) {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }))
    pb.authStore.save(`header.${payload}.signature`, user)
  } else {
    pb.authStore.clear()
  }

  queryClient.setQueryData(['auth', 'record'], user)
}

function renderWithAuth(element: ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>)
}

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
    renderWithAuth(<MobileMenu />)

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/dashboard', '/dashboard/compare', '/dashboard/settings'])
  })

  test('the page you are on is marked, and only that one', () => {
    currentPath = '/dashboard/compare'
    renderWithAuth(<MobileMenu />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'))
    expect(current).toHaveLength(1)
    expect(current[0].getAttribute('href')).toBe('/dashboard/compare')
  })

  test('a trailing slash still marks the page you are on', () => {
    currentPath = '/dashboard/settings/'
    renderWithAuth(<MobileMenu />)

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current'))
    expect(current[0].getAttribute('href')).toBe('/dashboard/settings')
  })

  test('signing out is a button and it signs out', async () => {
    renderWithAuth(<MobileMenu />)

    fireEvent.click(screen.getByText('signOut'))
    expect(pb.authStore.record).toBeNull()
    await waitFor(() => expect(screen.getByText('signIn')).toBeDefined())
  })

  test('signed out there is one way in and nothing else', () => {
    setUser(null)
    renderWithAuth(<MobileMenu />)

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(['/login'])
    expect(screen.queryByText('signOut')).toBeNull()
  })

  test('the address is never shown: it is not something to press', () => {
    renderWithAuth(<MobileMenu />)
    expect(screen.queryByText('me@example.com')).toBeNull()
  })

  test('the language you are reading is held down, the other is offered', () => {
    renderWithAuth(<MobileMenu />)

    const german = screen.getByText('Deutsch')
    const english = screen.getByText('English')
    expect(german.getAttribute('aria-pressed')).toBe('true')
    expect(english.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(english)
    expect(localStorage.getItem('rwthrank.locale')).toBe('en')
    localStorage.clear()
  })

  test('the panel is hidden once there is room for the real header', () => {
    const { container } = renderWithAuth(<MobileMenu />)
    expect((container.firstElementChild as HTMLElement).className).toContain('sm:hidden')
  })
})

describe('protected pages', () => {
  test('a signed-out visitor sees no private content and is sent to login', async () => {
    setUser(null)

    renderWithAuth(
      <SignedInOnly>
        <p>private</p>
      </SignedInOnly>
    )

    expect(screen.queryByText('private')).toBeNull()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
  })
})
