import { afterEach, describe, expect, mock, test } from 'bun:test'

import { call, WouldReplaceError } from '@/lib/api'
import { pb } from '@/lib/pocketbase'

const realFetch = globalThis.fetch

function answer(status: number, body: unknown, statusText = '') {
  const fetchMock = mock(async () =>
    body === undefined
      ? new Response('not json at all', { status, statusText })
      : new Response(JSON.stringify(body), {
          status,
          statusText,
          headers: { 'Content-Type': 'application/json' },
        })
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch

  return fetchMock
}

function user(id: string, email: string) {
  return { id, email, collectionId: 'users', collectionName: 'users' }
}

afterEach(() => {
  globalThis.fetch = realFetch
  pb.authStore.clear()
})

describe('call', () => {
  test('sends the session token, so the server knows who is asking', async () => {
    pb.authStore.save('token-123', null)
    const fetchMock = answer(200, { ok: true })

    await call('/api/rank')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${pb.baseURL}/api/rank`)
    expect((init.headers as Record<string, string>).Authorization).toBe('token-123')
  })

  test('signed out it still asks, and lets the server refuse', async () => {
    const fetchMock = answer(401, { message: 'The request requires valid record authorization token.' })

    await expect(call('/api/rank')).rejects.toThrow('valid record authorization token')

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('')
  })

  test('a rejected session is cleared so protected screens can redirect', async () => {
    pb.authStore.save('stale-token', user('user-1', 'me@example.com'))
    answer(401, { message: 'The request requires valid record authorization token.' })

    await expect(call('/api/rank')).rejects.toThrow('valid record authorization token')

    expect(pb.authStore.token).toBe('')
    expect(pb.authStore.record).toBeNull()
  })

  test('an old rejected request cannot clear a newer session', async () => {
    pb.authStore.save('old-token', user('user-1', 'old@example.com'))
    globalThis.fetch = mock(async () => {
      pb.authStore.save('new-token', user('user-2', 'new@example.com'))
      return new Response(
        JSON.stringify({ message: 'The request requires valid record authorization token.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    await expect(call('/api/rank')).rejects.toThrow('valid record authorization token')

    expect(pb.authStore.token).toBe('new-token')
    expect(pb.authStore.record?.id).toBe('user-2')
  })

  test('a caller may add headers without losing the token', async () => {
    pb.authStore.save('token-123', null)
    const fetchMock = answer(200, {})

    await call('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('token-123')
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.method).toBe('POST')
  })

  test('the failure a reader sees is the one the server wrote', async () => {
    answer(400, { message: 'Die Datei ist kein PDF.' })
    await expect(call('/api/transcript')).rejects.toThrow('Die Datei ist kein PDF.')
  })

  test('a reply that is not JSON falls back to the status line rather than throwing twice', async () => {
    answer(502, undefined, 'Bad Gateway')
    await expect(call('/api/rank')).rejects.toThrow('502 Bad Gateway')
  })

  test('an empty message is not shown as an empty error', async () => {
    answer(500, { message: '' }, 'Internal Server Error')
    await expect(call('/api/rank')).rejects.toThrow('500 Internal Server Error')
  })

  test('a message that is not a string is not rendered into the page', async () => {
    // A hostile or broken upstream could answer {"message": {...}}. Showing
    // that verbatim would put "[object Object]" in front of the user at best.
    answer(400, { message: { toString: () => 'sneaky' } })
    await expect(call('/api/rank')).rejects.toThrow('400')
  })

  test('the upload conflict is a question, not an error, and it names the stakes', async () => {
    answer(409, { message: 'exists', replaces: { program: 'Informatik', degree: 'Bachelor' } })

    const error = await call('/api/transcript').catch((e) => e)
    expect(error).toBeInstanceOf(WouldReplaceError)
    expect(error.program).toBe('Informatik')
    expect(error.degree).toBe('Bachelor')
  })

  test('a 409 without the details stays an ordinary error', async () => {
    answer(409, { message: 'conflict' })
    const error = await call('/api/transcript').catch((e) => e)
    expect(error).not.toBeInstanceOf(WouldReplaceError)
  })

  test('a successful reply is parsed and returned as it came', async () => {
    answer(200, { rank: 12, total: 240, percentile: 5 })
    expect(await call('/api/rank')).toEqual({ rank: 12, total: 240, percentile: 5 })
  })
})
