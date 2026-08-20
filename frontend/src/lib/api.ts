import { pb } from './pocketbase'

/**
 * The endpoints this app adds to PocketBase.
 *
 * They sit next to the collections and take the same bearer token, but the SDK
 * only routes to `/api/collections`, so they are fetched by hand. Kept apart
 * from the hooks that use them: what a failed response turns into is worth
 * checking on its own, and none of it needs React.
 */
export async function call(path: string, init?: RequestInit) {
  const token = pb.authStore.token
  const response = await fetch(`${pb.baseURL}${path}`, {
    ...init,
    headers: { Authorization: token, ...init?.headers },
  })

  if (response.status === 401 && token && pb.authStore.token === token) pb.authStore.clear()
  if (!response.ok) throw await failure(response)

  return response.json()
}

/**
 * Not an error the user should read: it is the server asking whether to go
 * ahead, and it names what is at stake.
 */
export class WouldReplaceError extends Error {
  constructor(
    readonly program: string,
    readonly degree: string
  ) {
    super('would replace')
  }
}

/**
 * PocketBase reports failures as `{ message }`, and that message is the one
 * worth showing. A missing route or a proxy in between answers with something
 * else entirely, and then the status line is the only honest thing left.
 */
async function failure(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: unknown
    replaces?: { program?: string; degree?: string }
  } | null

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
