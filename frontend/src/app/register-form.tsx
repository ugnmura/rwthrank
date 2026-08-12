'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import { useRequestOtp } from '@/lib/auth'
import { useSaveGrade } from '@/lib/rank'
import { savePending } from '@/lib/pending'
import { parseGrade } from '@/lib/study'

/**
 * Registration in one form: address, subject, grade, one button.
 *
 * Nothing is written until the address is confirmed, so the subject and grade
 * are parked in local storage and applied by the confirmation link. Someone who
 * is already signed in but never filled them in writes them straight away —
 * there is nothing left to prove.
 */
export function RegisterForm({ signedInEmail }: { signedInEmail?: string }) {
  const t = useTranslations('form')
  const format = useFormatter()

  const [email, setEmail] = useState('')
  const [grade, setGrade] = useState('')
  const [gradeError, setGradeError] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const requestOtp = useRequestOtp()
  const saveGrade = useSaveGrade()

  // The mail is out and the next step happens in the inbox. Deliberately no
  // code box: the link is the only way in, so offering both invites the
  // question of which one to use.
  if (sentTo) {
    return (
      <div className="border-l-2 border-primary pl-4">
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
    )
  }

  const pending = requestOtp.isPending || saveGrade.isPending
  const submitLabel = signedInEmail
    ? pending
      ? t('saving')
      : t('save')
    : pending
      ? t('sending')
      : t('reveal')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()

        const parsed = parseGrade(grade)
        if (parsed === null) {
          setGradeError(true)
          return
        }
        setGradeError(false)

        if (signedInEmail) {
          saveGrade.mutate(parsed)
          return
        }

        // Parked rather than sent: the address is not confirmed yet, and the
        // link is what turns these into a record.
        savePending({ grade: parsed })
        requestOtp.mutate(email, { onSuccess: () => setSentTo(email) })
      }}
    >
      <fieldset className="fieldset gap-4">
        <legend className="fieldset-legend font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
          {signedInEmail ? t('legendSignedIn') : t('legend')}
        </legend>

        {!signedInEmail && (
          <Field
            label={t('emailLabel')}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
          />
        )}


        {/* Typed, not picked. A Gesamtnote is an average, so 1,6 and 2,4 are
            ordinary values that no list of the eleven module marks contains. */}
        <Field
          label={t('gradeLabel')}
          type="text"
          value={grade}
          onChange={(value) => {
            setGrade(value)
            setGradeError(false)
          }}
          placeholder={format.number(2.4, { minimumFractionDigits: 1 })}
          inputMode="decimal"
          className={`tnum ${gradeError ? 'input-error' : ''}`}
          aria-invalid={gradeError || undefined}
        />
        {gradeError && (
          <p role="alert" className="text-sm text-error">
            {t('gradeInvalid')}
          </p>
        )}
      </fieldset>

      <button type="submit" disabled={pending} className="btn btn-primary btn-lg mt-6 w-full">
        {submitLabel}
      </button>

      {!signedInEmail && <p className="mt-3 text-xs text-base-content/50">{t('registerHint')}</p>}

      <div className="mt-3">
        <ErrorNote error={requestOtp.error ?? saveGrade.error} />
      </div>
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
        className={`input w-full bg-base-200 ${className}`}
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
