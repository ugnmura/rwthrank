'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

import { pb } from '@/lib/pocketbase'
import { takePending } from '@/lib/pending'
import { LocaleSwitcher } from '../locale-switcher'

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

    const [id, code] = window.location.hash.replace(/^#/, '').split('.')

    const run = async () => {
      if (!id || !code) {
        setState('failed')
        setMessage(t('linkIncomplete'))
        return
      }

      try {
        await pb.collection('users').authWithOTP(id, code)

        // The subject and grade were parked before the mail went out. Failing
        // to write them is not a failed verification: the session is real, and
        // the form asks again for what is missing.
        const pending = takePending()
        if (pending) {
          try {
            await pb.collection('users').update(pb.authStore.record!.id, pending)
          } catch {
            // Left to the signed-in form on the next screen.
          }
        }

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
      <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <span className="text-base-content/70">rwthrank</span>
        <LocaleSwitcher />
      </header>

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
