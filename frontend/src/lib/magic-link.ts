/**
 * Reads the credentials out of a sign-in link.
 *
 * The link is `/verify#<otpId>.<code>`. The fragment is deliberate: a query
 * string is sent to the server, written into access logs and kept in the
 * Referer of anything the page loads, while a fragment never leaves the
 * browser. It also survives the mail transport — quoted-printable soft-wraps a
 * long line by breaking on `=`, which corrupted the query-string version in
 * real inboxes while looking perfect in a local mail catcher.
 *
 * Strict on purpose. Anything that is not exactly two non-empty parts is a
 * broken link rather than something to hand to the auth endpoint and see what
 * happens.
 */
export type MagicLink = { otpId: string; code: string }

export function readMagicLink(hash: string): MagicLink | null {
  const raw = hash.replace(/^#/, '')
  if (!raw) return null

  const parts = raw.split('.')
  if (parts.length !== 2) return null

  const [otpId, code] = parts.map(decodeSafely)
  if (!otpId || !code) return null

  // Both halves are ids and digits as PocketBase issues them. Anything else is
  // a mangled link, or someone probing with a crafted one.
  if (!/^[A-Za-z0-9_-]+$/.test(otpId) || !/^[A-Za-z0-9]+$/.test(code)) return null

  return { otpId, code }
}

/** A half-escaped fragment is a broken link, not a crash. */
function decodeSafely(part: string): string {
  try {
    return decodeURIComponent(part)
  } catch {
    return ''
  }
}
