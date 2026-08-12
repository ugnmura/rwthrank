'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuthRecord } from './auth'
import { pb } from './pocketbase'
import type { UsersResponse } from '@/types/pocketbase'

/**
 * The two fields this app adds to a user. They live on the collection but not
 * yet in the generated types, so they are spelled out here until the next
 * `bun run typegen` picks them up.
 */
// The account holds an email and nothing else now; everything a ranking
// needs lives on a transcript.
export type Profile = UsersResponse

/** `GET /api/rank`. Everything but `total` is null until the user has a grade. */
export type RankSummary = {
  transcript: string | null
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
const transcriptsKey = ['transcripts'] as const

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
export class WouldReplaceError extends Error {
  constructor(readonly program: string, readonly degree: string) {
    super('would replace')
  }
}

async function failure(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown
    replaces?: { program?: string; degree?: string }
  } | null

  // Not an error the user should read: it is the server asking whether to go
  // ahead, and it names what is at stake.
  if (response.status === 409 && body?.replaces) {
    return new WouldReplaceError(body.replaces.program ?? '', body.replaces.degree ?? '')
  }
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
export function useRank(view: 'auto' | 'overall' = 'auto', transcript?: string) {
  const { data: user } = useAuthRecord()

  return useQuery({
    queryKey: [...rankKey, user?.id, view, transcript],
    // Switching the view changes the key, which would otherwise blank the data
    // and unmount the whole dashboard: it reads as the page reloading. The old
    // numbers stay put until the new ones arrive.
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams()
      if (view === 'overall') params.set('scope', 'overall')
      if (transcript) params.set('transcript', transcript)
      const query = params.toString()

      return call(query ? `/api/rank?${query}` : '/api/rank') as Promise<RankSummary>
    },
    enabled: !!user,
  })
}

/**
 * Records a grade nobody uploaded a document for.
 *
 * It becomes a transcript with a grade and nothing else, so the ranking reads
 * every answer from one place instead of the account holding a second one that
 * a later upload could contradict.
 */
export function useSaveGrade() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (grade: number) =>
      call('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rankKey })
      queryClient.invalidateQueries({ queryKey: transcriptsKey })
    },
  })
}

/** Sends the PDF to be read. The answer is data, not a stored file. */
export function useUploadTranscript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ file, replace }: { file: File; replace?: boolean }) => {
      const body = new FormData()
      body.set('file', file)

      // No Content-Type here on purpose: only the browser knows the multipart
      // boundary it is about to write.
      return call(replace ? '/api/transcript?replace=1' : '/api/transcript', {
        method: 'POST',
        body,
      }) as Promise<Transcript>
    },
    // An upload writes a transcript, replaces any previous one for that subject
    // and rewrites its modules, so both the list and the ranking are stale the
    // moment it succeeds.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transcriptsKey })
      queryClient.invalidateQueries({ queryKey: rankKey })
    },
  })
}

/** A stored transcript, as the owner sees it. */
export type StoredTranscript = {
  id: string
  issued: string
  program: string
  degree: string
  grade: number
  credits: number
  maxCredits: number
  pdf: string
  uploaded: string
}

/** The user's own uploads, newest first. */
export function useTranscripts() {
  const { data: user } = useAuthRecord()

  return useQuery({
    queryKey: [...transcriptsKey, user?.id],
    enabled: Boolean(user),
    queryFn: () =>
      pb
        .collection('transcripts')
        .getFullList({ sort: '-uploaded' }) as unknown as Promise<StoredTranscript[]>,
  })
}

/**
 * Removes one upload.
 *
 * The results hanging off it go too, through the cascade on the relation, so
 * the ranking is refetched rather than patched.
 */
export function useDeleteTranscript() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => pb.collection('transcripts').delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transcriptsKey })
      queryClient.invalidateQueries({ queryKey: rankKey })
    },
  })
}

/** Names the programme and degree on a transcript that has none. */
export function useSetSubject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, program, degree }: { id: string; program: string; degree: string }) =>
      call(`/api/transcript/${id}/subject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program, degree }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transcriptsKey })
      queryClient.invalidateQueries({ queryKey: rankKey })
    },
  })
}

/** One module on a transcript, with the course it belongs to expanded. */
export type Result = {
  id: string
  course: string
  grade: number | null
  passed: boolean
  credits: number | null
  semester: string
  expand?: { course?: { name: string } }
}

/**
 * The modules read off one transcript.
 *
 * Only fetched once a transcript is opened: a person can have several, and
 * loading every module of every one to show a list of documents would be work
 * nobody asked for.
 */
export function useResults(transcript?: string) {
  return useQuery({
    queryKey: ['results', transcript],
    enabled: Boolean(transcript),
    queryFn: () =>
      pb.collection('results').getFullList({
        filter: `transcript = "${transcript}"`,
        expand: 'course',
        sort: 'semester',
      }) as unknown as Promise<Result[]>,
  })
}

/** Where the caller stands in one class. */
export type CourseRank = {
  course: string
  grade: number | null
  rank: number | null
  total: number
  percentile: number | null
}

/** Fetched only once a class is opened, the same way modules are. */
export function useCourseRank(course?: string) {
  return useQuery({
    queryKey: ['course-rank', course],
    enabled: Boolean(course),
    queryFn: () => call(`/api/rank/course/${course}`) as Promise<CourseRank>,
  })
}
