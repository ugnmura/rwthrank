'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { pb } from './pocketbase'
import type { UsersResponse } from '@/types/pocketbase'

const authKey = ['auth', 'record'] as const

/**
 * Current user, or null when signed out.
 *
 * pb.authStore is a local store rather than a request, so this mirrors it into
 * the query cache and lets its change events drive re-renders. Reading it in a
 * queryFn keeps it out of the server render, where localStorage doesn't exist
 * and the value would disagree with the client's first paint.
 */
export function useAuthRecord() {
  const queryClient = useQueryClient()

  useEffect(
    () =>
      pb.authStore.onChange(() => {
        queryClient.setQueryData(authKey, pb.authStore.record ?? null)
      }),
    [queryClient]
  )

  return useQuery({
    queryKey: authKey,
    queryFn: () => (pb.authStore.record as UsersResponse | null) ?? null,
    staleTime: Infinity,
  })
}

/** Step one: mail a code. Returns the otpId that step two needs. */
export function useRequestOtp() {
  return useMutation({
    mutationFn: (email: string) => pb.collection('users').requestOTP(email),
  })
}

/** Step two: trade the code for a session. Registers the account if it is new. */
export function useVerifyOtp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ otpId, code }: { otpId: string; code: string }) =>
      pb.collection('users').authWithOTP(otpId, code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKey }),
  })
}

export function useLogout() {
  return () => pb.authStore.clear()
}
