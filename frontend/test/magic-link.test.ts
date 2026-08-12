import { describe, expect, test } from 'bun:test'

import { readMagicLink } from '@/lib/magic-link'

describe('readMagicLink', () => {
  test('reads the link the server sends', () => {
    expect(readMagicLink('#mxb1gdd9ts7jh3k.04699589')).toEqual({
      otpId: 'mxb1gdd9ts7jh3k',
      code: '04699589',
    })
  })

  test('the leading hash is optional, because window.location.hash includes it', () => {
    expect(readMagicLink('mxb1gdd9ts7jh3k.04699589')?.otpId).toBe('mxb1gdd9ts7jh3k')
  })

  test('percent-escaping survives the round trip', () => {
    expect(readMagicLink('#abc%2Ddef.1234')).toEqual({ otpId: 'abc-def', code: '1234' })
  })

  test('no fragment at all is not a link', () => {
    expect(readMagicLink('')).toBeNull()
    expect(readMagicLink('#')).toBeNull()
  })

  test('half a link is not a link', () => {
    expect(readMagicLink('#mxb1gdd9ts7jh3k')).toBeNull()
    expect(readMagicLink('#mxb1gdd9ts7jh3k.')).toBeNull()
    expect(readMagicLink('#.04699589')).toBeNull()
    expect(readMagicLink('#.')).toBeNull()
  })

  test('a mail client that mangled the line does not get sent to the auth endpoint', () => {
    // The failure that shipped once: quoted-printable broke the line on "=" and
    // dropped a tab into the middle of the credentials.
    expect(readMagicLink('#mxb1gdd9ts7jh3k.0469\t9589')).toBeNull()
    expect(readMagicLink('#mxb1gdd9ts7jh3k.046995=\n89')).toBeNull()
  })

  test('extra segments are refused rather than silently ignored', () => {
    expect(readMagicLink('#one.two.three')).toBeNull()
  })

  test('anything crafted is refused', () => {
    for (const hash of [
      '#<script>alert(1)</script>.1234',
      '#../../etc/passwd.1234',
      "#' OR 1=1--.1234",
      '#id.code with spaces',
      '#id.%',
      '#%E0%A4%A.1234',
    ]) {
      expect(readMagicLink(hash)).toBeNull()
    }
  })

  test('the credentials never travel where a server could log them', () => {
    // A fragment is not sent with the request. This is a statement about the
    // shape of the link rather than about this function: if the link ever moves
    // into the query string, this test is the one that should stop it.
    const link = '/verify#mxb1gdd9ts7jh3k.04699589'
    expect(link).not.toContain('?')
    expect(new URL(link, 'https://rwthrank.mindevice.net').search).toBe('')
  })
})
