'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthRecord } from './auth'
import { pb } from './pocketbase'
import type { UsersResponse } from '@/types/pocketbase'

/**
 * The two fields this app adds to a user. They live on the collection but not
 * yet in the generated types, so they are spelled out here until the next
 * `bun run typegen` picks them up.
 */
export type Profile = UsersResponse & { program?: string; degree?: string; grade?: number }

/** `GET /api/rank`. Everything but `total` is null until the user has a grade. */
export type RankSummary = {
  /** "program" once a subject and degree are set, "overall" until then. */
  scope: 'program' | 'overall'
  program: string | null
  degree: string | null
  grade: number | null
  rank: number | null
  total: number
  percentile: number | null
}

/** `POST /api/transcript`. What the server read out of the PDF, nothing stored. */
export type Transcript = {
  program: string
  degree: string
  grade: number
  credits: number
  maxCredits: number
  moduleCount: number
}

const rankKey = ['rank'] as const

// Both endpoints sit on PocketBase next to the collections and take the same
// bearer token, but the SDK only routes to /api/collections — so they are fetched
// by hand.
async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${pb.baseURL}${path}`, {
    ...init,
    headers: { Authorization: pb.authStore.token, ...init?.headers },
  })

  if (!response.ok) throw await failure(response)

  return response.json()
}

/**
 * PocketBase reports failures as `{ message }`, and that message is the one
 * worth showing. A missing route or a proxy in between answers with something
 * else entirely, and then the status line is the only honest thing left.
 */
async function failure(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null
  const message = body?.message

  return new Error(
    typeof message === 'string' && message
      ? message
      : `${response.status} ${response.statusText}`.trim()
  )
}

/**
 * The user's position in their own program.
 *
 * Keyed by user id so a second account on the same browser never reads the
 * first one's cached rank.
 */
export function useRank(view: 'auto' | 'overall' = 'auto') {
  const { data: user } = useAuthRecord()

  return useQuery({
    queryKey: [...rankKey, user?.id, view],
    queryFn: () =>
      call(view === 'overall' ? '/api/rank?scope=overall' : '/api/rank') as Promise<RankSummary>,
    enabled: !!user,
  })
}

/**
 * Writes program, degree and grade onto the caller's own record — the users collection
 * allows exactly that, and nothing else on the record is touched. The SDK folds
 * the response back into `pb.authStore`, so `useAuthRecord` sees it too.
 */
export function useSaveProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: { program?: string; degree?: string; grade?: number }) => {
      const record = pb.authStore.record
      // Unreachable from the UI: every caller runs behind a session.
      if (!record) throw new Error('no session')

      return pb.collection('users').update(record.id, patch)
    },
    onSuccess: () => {
      // Both: the rank re-scopes, and the record behind the filter's current
      // values is refetched so the controls agree with what was saved.
      queryClient.invalidateQueries({ queryKey: rankKey })
      queryClient.invalidateQueries({ queryKey: ['auth', 'record'] })
    },
  })
}

/** Sends the PDF to be read. The answer is data, not a stored file. */
export function useUploadTranscript() {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData()
      body.set('file', file)

      // No Content-Type here on purpose: only the browser knows the multipart
      // boundary it is about to write.
      return call('/api/transcript', { method: 'POST', body }) as Promise<Transcript>
    },
  })
}
