/**
 * The grade, parked between the form and the confirmation link.
 *
 * The link arrives in a mail client and may open a fresh tab, so the two values
 * cannot simply live in component state. They are not sent to the server before
 * the address is confirmed, which is the whole point of confirming it.
 *
 * Opening the link on a different device loses them. That is fine: the user
 * lands signed in with no grade, which is a state the form already handles.
 */
const KEY = 'rwthrank.pending-profile'

export type PendingProfile = { grade: number }

export function savePending(profile: PendingProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    // Private mode, or storage full. The fallback is asking again after
    // verification, so losing this is never fatal.
  }
}

export function takePending(): PendingProfile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)

    const parsed = JSON.parse(raw) as PendingProfile
    if (typeof parsed?.grade !== 'number') return null

    return parsed
  } catch {
    return null
  }
}
