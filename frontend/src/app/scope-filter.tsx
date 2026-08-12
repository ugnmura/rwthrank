'use client'

import { useTranslations } from 'next-intl'

/**
 * Switches the ranking between the user's own subject and everyone.
 *
 * Always rendered once there is a rank, including when the transcript has no
 * subject yet: hiding it in that state left the overall view with no way back.
 * The subject option is disabled instead, which says why rather than vanishing.
 *
 * A view, not a setting. The stored subject stays put either way, so flipping
 * back and forth never costs what a transcript filled in.
 */
export function ScopeFilter({
  view,
  onChange,
  program,
  degree,
}: {
  view: 'auto' | 'overall'
  onChange: (view: 'auto' | 'overall') => void
  program?: string | null
  degree?: string | null
}) {
  const t = useTranslations('filter')
  const known = Boolean(program && degree)

  return (
    <div className="border-l-2 border-base-300 pl-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
        {t('viewLabel')}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!known}
          onClick={() => onChange('auto')}
          className={`btn btn-sm ${view === 'auto' && known ? 'btn-primary' : 'btn-ghost'}`}
        >
          {known ? t('viewSubjectDegree', { program: program!, degree: degree! }) : t('viewSubjectUnset')}
        </button>
        <button
          type="button"
          onClick={() => onChange('overall')}
          className={`btn btn-sm ${view === 'overall' || !known ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('viewAll')}
        </button>
      </div>

      {!known && <p className="mt-2 text-xs text-base-content/50">{t('viewHint')}</p>}
    </div>
  )
}
