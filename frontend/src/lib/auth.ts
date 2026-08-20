'use client'

import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { pb } from './pocketbase'
import type { UsersResponse } from '@/types/pocketbase'

const authKey = ['auth', 'record'] as const

function currentAuthRecord() {
  if (pb.authStore.token && !pb.authStore.isValid) {
    pb.authStore.clear()
    return null
  }

  return (pb.authStore.record as UsersResponse | null) ?? null
}

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
        queryClient.setQueryData(authKey, currentAuthRecord())
      }),
    [queryClient]
  )

  return useQuery({
    queryKey: authKey,
    queryFn: currentAuthRecord,
    staleTime: Infinity,
  })
}

/** Step one: mail a code. Returns the otpId that step two needs. */
export function useRequestOtp() {
  return useMutation({
    // The grade rides along so the server can store it with the account it
    // belongs to. Sending it later would mean asking for the same number twice
    // if anything went wrong in between.
    mutationFn: ({ email, grade }: { email: string; grade?: number }) =>
      pb.send('/api/collections/users/request-otp', {
        method: 'POST',
        body: { email, ...(grade ? { grade } : {}) },
      }) as Promise<{ otpId: string }>,
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
