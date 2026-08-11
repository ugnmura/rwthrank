'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { useAuthRecord, useLogout, useRequestOtp, useVerifyOtp } from '@/lib/auth'
import { GradeCurve } from './grade-curve'
import { LocaleSwitcher } from './locale-switcher'

export default function Home() {
  const t = useTranslations()
  const { data: user, isPending } = useAuthRecord()

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <span className="text-base-content/70">rwthrank</span>
        <LocaleSwitcher />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-12 sm:px-10">
        <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-base-content/35 uppercase">
          {t('header.tagline')}
        </p>
        <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
          {t('hero.title')}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-base-content/60">
          {t('hero.subtitle')}
        </p>

        <div className="mt-8 max-w-sm">
          {isPending ? (
            <div className="h-[104px]" aria-hidden />
          ) : user ? (
            <SignedIn email={user.email} />
          ) : (
            <SignInForm />
          )}
        </div>
      </main>

      {/* Full-bleed on purpose: the distribution is the floor the page stands on. */}
      <footer className="w-full px-6 pb-8 sm:px-10">
        <GradeCurve />
      </footer>
    </div>
  )
}

function SignedIn({ email }: { email: string }) {
  const t = useTranslations('signedIn')
  const logout = useLogout()

  return (
    <div className="border-l-2 border-primary pl-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
        {t('label')}
      </p>
      <p className="mt-1 font-medium break-all">{email}</p>
      <p className="mt-3 text-sm text-base-content/60">{t('next')}</p>
      <button onClick={logout} className="btn btn-ghost btn-sm mt-4 -ml-3">
        {t('signOut')}
      </button>
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
  // existing one — the backend deliberately won't tell us which.
  if (!otpId) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          requestOtp.mutate(email, { onSuccess: (result) => setOtpId(result.otpId) })
        }}
        className="space-y-4"
      >
        <Field
          label={t('emailLabel')}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
        />
        <button type="submit" disabled={requestOtp.isPending} className="btn btn-primary w-full">
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
      className="space-y-4"
    >
      <Field
        label={t('codeLabel')}
        type="text"
        value={code}
        onChange={setCode}
        placeholder={t('codePlaceholder')}
        autoComplete="one-time-code"
        inputMode="numeric"
        className="tnum font-mono tracking-[0.3em]"
        autoFocus
      />
      <p className="text-xs text-base-content/50">
        {t('codeSentTo', { email })}
      </p>
      <button type="submit" disabled={verifyOtp.isPending} className="btn btn-primary w-full">
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
        className="link link-hover text-xs text-base-content/50"
      >
        {t('otherAddress')}
      </button>
    </form>
  )
}

function Field({
  label,
  onChange,
  className = '',
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<'input'>, 'onChange' | 'value'>) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
        {label}
      </span>
      <input
        {...props}
        required
        onChange={(event) => onChange(event.target.value)}
        className={`input w-full bg-base-200/60 ${className}`}
      />
    </label>
  )
}

function ErrorNote({ error }: { error: Error | null }) {
  if (!error) return null

  return (
    <p role="alert" className="text-sm text-error">
      {error.message}
    </p>
  )
}
