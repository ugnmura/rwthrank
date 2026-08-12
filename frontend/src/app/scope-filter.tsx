'use client'

import { useTranslations } from 'next-intl'

/**
 * Switches the ranking between the user's own subject and everyone.
 *
 * A view, not a setting: the stored subject stays put either way, so flipping
 * back and forth never costs what a transcript filled in.
 */
export function ScopeFilter({
  view,
  onChange,
  program,
}: {
  view: 'auto' | 'overall'
  onChange: (view: 'auto' | 'overall') => void
  program: string
}) {
  const t = useTranslations('filter')

  return (
    <div className="border-l-2 border-base-300 pl-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
        {t('viewLabel')}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange('auto')}
          className={`btn btn-sm ${view === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('viewSubject', { program })}
        </button>
        <button
          type="button"
          onClick={() => onChange('overall')}
          className={`btn btn-sm ${view === 'overall' ? 'btn-primary' : 'btn-ghost'}`}
        >
          {t('viewAll')}
        </button>
      </div>
    </div>
  )
}
