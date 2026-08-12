'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { useAuthRecord, useRequestOtp } from '@/lib/auth'
import { SiteHeader } from '../site-header'

/**
 * Signing in for someone who already has an account: an address, nothing else.
 *
 * The front page asks for a grade as well, because that form is registering.
 * Coming back needs neither the grade nor the explanation around it, and being
 * asked again for something already stored reads like the account was lost.
 */
export default function LoginPage() {
  const t = useTranslations('login')
  const { data: user } = useAuthRecord()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const requestOtp = useRequestOtp()

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>

        {sentTo ? (
          <div className="mt-8 max-w-sm border-l-2 border-primary pl-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
              {t('sentLabel')}
            </p>
            <p className="mt-1 font-medium break-all">{sentTo}</p>
            <p className="mt-3 text-sm text-base-content/60">{t('sentBody')}</p>
            <button
              type="button"
              onClick={() => {
                setSentTo(null)
                requestOtp.reset()
              }}
              className="link link-hover mt-4 text-xs text-base-content/50"
            >
              {t('otherAddress')}
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              // No grade: this is a return, not a registration.
              requestOtp.mutate({ email }, { onSuccess: () => setSentTo(email) })
            }}
            className="mt-8 max-w-sm"
          >
            <label className="block">
              <span className="mb-2 block font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
                {t('emailLabel')}
              </span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t('emailPlaceholder')}
                className="input w-full bg-base-200"
              />
            </label>

            <button
              type="submit"
              disabled={requestOtp.isPending}
              className="btn btn-primary btn-lg mt-4 w-full"
            >
              {requestOtp.isPending ? t('sending') : t('submit')}
            </button>

            <p className="mt-3 text-xs text-base-content/50">{t('hint')}</p>

            {requestOtp.error && (
              <p role="alert" className="mt-3 text-sm text-error">
                {requestOtp.error.message}
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  )
}
