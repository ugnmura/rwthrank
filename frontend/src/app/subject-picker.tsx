'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { useSetSubject } from '@/lib/rank'
import { DEGREES, PROGRAMS } from '@/lib/study'

/**
 * Names the subject on a transcript that has none.
 *
 * Only the placeholder a typed grade creates needs this: an uploaded
 * Notenspiegel says its own programme and degree, so there is nothing to ask.
 */
export function SubjectPicker({ id }: { id: string }) {
  const t = useTranslations('filter')
  const save = useSetSubject()

  const [program, setProgram] = useState('')
  const [degree, setDegree] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ id, program, degree })
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <select
        required
        value={degree}
        onChange={(event) => setDegree(event.target.value)}
        className="select select-sm bg-base-200"
      >
        <option value="" disabled>
          {t('degreePlaceholder')}
        </option>
        {DEGREES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <select
        required
        value={program}
        onChange={(event) => setProgram(event.target.value)}
        className="select select-sm bg-base-200"
      >
        <option value="" disabled>
          {t('programPlaceholder')}
        </option>
        {PROGRAMS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <button type="submit" disabled={save.isPending} className="btn btn-sm btn-primary">
        {save.isPending ? t('saving') : t('apply')}
      </button>

      {save.error && (
        <p role="alert" className="w-full text-sm text-error">
          {save.error.message}
        </p>
      )}
    </form>
  )
}
