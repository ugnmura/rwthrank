'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { useAuthRecord, useLogout, useRequestOtp, useVerifyOtp } from '@/lib/auth'
import { GradeCurve } from './grade-curve'
import { LocaleSwitcher } from './locale-switcher'

const CODE_LENGTH = 8

export default function Home() {
  const t = useTranslations()

  return (
    <>
      <div className="navbar min-h-0 bg-neutral px-0 py-0 text-neutral-content">
        <div className="navbar-start">
          <span className="bg-primary px-3 py-3 font-bold text-primary-content">RWTH</span>
          <span className="px-3 text-lg">rwthrank</span>
        </div>
        <div className="navbar-end pr-2">
          <LocaleSwitcher />
        </div>
      </div>

      <div className="breadcrumbs border-b border-base-300 bg-base-200 px-4 py-2 text-sm">
        <ul>
          <li>rwthrank</li>
          <li>{t('nav.breadcrumb')}</li>
        </ul>
      </div>

      <div className="flex flex-1 flex-col lg:flex-row">
        <main className="flex-1 px-4 py-8 lg:px-8">
          <div className="max-w-2xl space-y-6">
            <section>
              <h1 className="mb-3 text-2xl font-bold">{t('content.welcomeHeading')}</h1>
              <p className="leading-relaxed">{t('content.welcomeBody')}</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-bold">{t('content.loginHeading')}</h2>
              <p className="leading-relaxed">{t('content.loginBody')}</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-bold">{t('content.firstTimeHeading')}</h2>
              <p className="leading-relaxed">{t('content.firstTimeBody')}</p>
            </section>

            <div className="divider" />

            <section>
              <h2 className="mb-3 text-lg font-bold">{t('content.scaleHeading')}</h2>
              <GradeCurve />
            </section>
          </div>
        </main>

        {/* The action column, kept above the reading matter on a phone. */}
        <aside className="order-first bg-primary px-4 py-8 text-primary-content lg:order-last lg:w-88 lg:shrink-0 lg:px-6">
          <SignInPanel />
        </aside>
      </div>

      <footer className="footer footer-horizontal justify-between bg-neutral px-4 py-3 text-sm text-neutral-content/80">
        <span>{t('footer.copyright')}</span>
        <span>{t('footer.sample')}</span>
      </footer>
    </>
  )
}

function SignInPanel() {
  const t = useTranslations('panel')
  const { data: user, isPending } = useAuthRecord()

  return (
    <div className="lg:sticky lg:top-8">
      <h2 className="mb-4 text-xl">{t('heading')}</h2>
      {isPending ? <div className="h-48" aria-hidden /> : user ? <SignedIn email={user.email} /> : <SignInForm />}
    </div>
  )
}

function SignedIn({ email }: { email: string }) {
  const t = useTranslations('signedIn')
  const logout = useLogout()

  return (
    <div className="card bg-base-100 text-base-content">
      <div className="card-body gap-3 p-4">
        <div>
          <p className="text-sm text-base-content/70">{t('label')}</p>
          <p className="font-bold break-all">{email}</p>
        </div>
        <p className="text-sm">{t('next')}</p>
        <button onClick={logout} className="btn btn-outline btn-primary btn-block">
          {t('signOut')}
        </button>
      </div>
    </div>
  )
}

function SignInForm() {
  const t = useTranslations('form')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [otpId, setOtpId] = useState<string | null>(null)

  const requestOtp = useRequestOtp()
  const verifyOtp = useVerifyOtp()

  // One form, two steps. The same submit registers a new address or signs in an
  // existing one, because the backend deliberately will not say which.
  if (!otpId) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          requestOtp.mutate(email, { onSuccess: (result) => setOtpId(result.otpId) })
        }}
      >
        <fieldset className="fieldset">
          <legend className="fieldset-legend text-primary-content">{t('emailLabel')}</legend>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('emailPlaceholder')}
            className="input w-full bg-base-100 text-base-content"
          />
        </fieldset>

        <button
          type="submit"
          disabled={requestOtp.isPending}
          className="btn btn-block mt-3 bg-base-100 text-primary"
        >
          {requestOtp.isPending && <span className="loading loading-spinner loading-xs" />}
          {requestOtp.isPending ? t('sending') : t('sendCode')}
        </button>

        <ErrorNote error={requestOtp.error} />
      </form>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        verifyOtp.mutate({ otpId, code })
      }}
    >
      <p className="mb-4 text-sm leading-relaxed">{t('codeSentTo', { email })}</p>

      <fieldset className="fieldset">
        <legend className="fieldset-legend text-primary-content">{t('codeLabel')}</legend>
        {/* text-lg keeps eight slots inside the panel; .otp sizes itself in ch. */}
        <div className="otp max-w-full bg-base-100 text-lg text-base-content">
          <input
            type="text"
            inputMode="numeric"
            pattern={`\\d{${CODE_LENGTH}}`}
            maxLength={CODE_LENGTH}
            autoComplete="one-time-code"
            autoFocus
            required
            aria-label={t('codeLabel')}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
          {Array.from({ length: CODE_LENGTH }, (_, slot) => (
            <span key={slot} />
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={verifyOtp.isPending}
        className="btn btn-block mt-3 bg-base-100 text-primary"
      >
        {verifyOtp.isPending && <span className="loading loading-spinner loading-xs" />}
        {verifyOtp.isPending ? t('checking') : t('signIn')}
      </button>

      <ErrorNote error={verifyOtp.error} />

      <button
        type="button"
        onClick={() => {
          setOtpId(null)
          setCode('')
          verifyOtp.reset()
        }}
        className="link mt-3 text-sm"
      >
        {t('otherAddress')}
      </button>
    </form>
  )
}

function ErrorNote({ error }: { error: Error | null }) {
  if (!error) return null

  return (
    <div role="alert" className="alert alert-error mt-3 text-sm">
      {error.message}
    </div>
  )
}
