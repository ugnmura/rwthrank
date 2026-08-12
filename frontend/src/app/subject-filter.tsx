'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { useSaveProfile } from '@/lib/rank'
import { DEGREES, PROGRAMS } from '@/lib/study'

/**
 * Narrows the ranking from everyone to one programme and degree.
 *
 * Registration deliberately asks for nothing but an address and a grade, so this
 * is opt-in afterwards. Uploading a transcript fills the same two values without
 * anyone picking them, since the document names both.
 */
export function SubjectFilter({
  program: current,
  degree: currentDegree,
}: {
  program?: string
  degree?: string
}) {
  const t = useTranslations('filter')
  const save = useSaveProfile()

  const [program, setProgram] = useState(current ?? '')
  const [degree, setDegree] = useState(currentDegree ?? '')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ program, degree })
      }}
      className="border-l-2 border-base-300 pl-4"
    >
      <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
        {t('label')}
      </p>
      <p className="mt-1 mb-3 text-sm text-base-content/60">{t('help')}</p>

      <div className="flex flex-wrap gap-2">
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
      </div>

      {save.error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {save.error.message}
        </p>
      )}
    </form>
  )
}
