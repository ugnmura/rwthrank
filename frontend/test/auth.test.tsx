import { afterEach, describe, expect, test } from 'bun:test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { useAuthRecord } from '@/lib/auth'
import { pb } from '@/lib/pocketbase'

afterEach(() => {
  cleanup()
  pb.authStore.clear()
})

describe('useAuthRecord', () => {
  test('an expired stored session is cleared before it can render as signed in', async () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }))
    pb.authStore.save(`header.${payload}.signature`, {
      id: 'user-1',
      email: 'me@example.com',
      collectionId: 'users',
      collectionName: 'users',
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    const { result } = renderHook(() => useAuthRecord(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toBeNull()
    expect(pb.authStore.token).toBe('')
    expect(pb.authStore.record).toBeNull()
  })
})
