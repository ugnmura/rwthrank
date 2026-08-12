'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { SiteHeader } from '../site-header'
import { useQueryClient } from '@tanstack/react-query'

import { readMagicLink } from '@/lib/magic-link'
import { pb } from '@/lib/pocketbase'

type State = 'checking' | 'done' | 'failed'

export default function VerifyPage() {
  const t = useTranslations('verify')
  const router = useRouter()
  const queryClient = useQueryClient()

  // The token rides in the fragment, which never reaches the server and so is
  // only readable after mount. Starts optimistic; a malformed link falls
  // through to the failure state below.
  const [state, setState] = useState<State>('checking')
  const [message, setMessage] = useState('')

  // The link is single-use, so redeeming it twice fails. React runs effects
  // twice in development, which would do exactly that.
  const redeemed = useRef(false)

  useEffect(() => {
    if (redeemed.current) return
    redeemed.current = true

    const link = readMagicLink(window.location.hash)

    const run = async () => {
      if (!link) {
        setState('failed')
        setMessage(t('linkIncomplete'))
        return
      }

      try {
        await pb.collection('users').authWithOTP(link.otpId, link.code)

        // Nothing to apply here: the grade was stored with the account when the
        // link was requested, so verifying is only about the session.
        await queryClient.invalidateQueries({ queryKey: ['rank'] })
        setState('done')
      } catch (error) {
        setState('failed')
        setMessage(error instanceof Error ? error.message : t('linkFailed'))
      }
    }

    void run()
  }, [queryClient, t])

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        {state === 'checking' && (
          <p className="flex items-center gap-3 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            {t('checking')}
          </p>
        )}

        {state === 'done' && (
          <>
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">
              {t('confirmedTitle')}
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-base-content/60">
              {t('confirmedBody')}
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn btn-primary btn-lg mt-8 max-w-sm"
            >
              {t('seeRank')}
            </button>
          </>
        )}

        {state === 'failed' && (
          <>
            <h1 className="font-display text-3xl leading-[1.05] font-bold tracking-tight sm:text-4xl">
              {t('failedTitle')}
            </h1>
            <p role="alert" className="mt-3 max-w-sm text-sm leading-relaxed text-error">
              {message}
            </p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="btn btn-outline mt-8 max-w-sm"
            >
              {t('startOver')}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
