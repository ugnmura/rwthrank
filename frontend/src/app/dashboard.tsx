'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { useRank } from '@/lib/rank'

/**
 * Where the user stands: against everyone by default, or inside their own
 * programme and degree once those are set. The scope is
 * said twice on purpose: a rank without the field it was measured in is a number
 * people misread.
 */
export function Dashboard() {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const { data, error, isFetching, refetch } = useRank()

  // A grade keeps its tenth even when it is a round 2,0; a percentile drops it.
  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  const percent = (value: number) => format.number(value, { maximumFractionDigits: 1 })

  if (error) {
    return (
      <div role="alert" className="alert alert-error alert-soft">
        <div>
          <p>{t('error')}</p>
          <p className="mt-1 font-mono text-xs opacity-70">{error.message}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn btn-sm"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  // Nulls mean an account without a grade, which the page answers with the form.
  // Seeing them here is the moment between a write and the refetch, so it reads
  // as loading rather than as an empty state.
  if (
    !data ||
    data.grade === null ||
    data.rank === null ||
    data.percentile === null
  ) {
    return (
      <span
        role="status"
        aria-label={t('loading')}
        className="loading loading-dots loading-md text-primary"
      />
    )
  }

  return (
    <div>
      <p className="mb-4 font-mono text-[11px] tracking-[0.18em] text-base-content/35 uppercase">
        {t('label')}
      </p>
      <h1 className="tnum font-display text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl">
        {t('place', { rank: format.number(data.rank), total: format.number(data.total) })}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-base-content/60">
        {data.scope === 'program' ? t('scope', { program: data.program ?? '' }) : t('scopeOverall')}
      </p>

      <div className="stats stats-vertical mt-8 w-full bg-base-200/60 sm:stats-horizontal">
        <div className="stat">
          <div className="stat-title">{t('topLabel')}</div>
          <div className="stat-value tnum text-secondary">
            {t('topValue', { percentile: percent(data.percentile) })}
          </div>
          <div className="stat-desc">{data.scope === 'program' ? t('topDesc', { program: data.program ?? '' }) : t('statOverall')}</div>
        </div>

        <div className="stat">
          <div className="stat-title">{t('gradeLabel')}</div>
          <div className="stat-value tnum">{grade(data.grade)}</div>
          <div className="stat-desc">{t('gradeDesc')}</div>
        </div>

        <div className="stat">
          <div className="stat-title">{t('totalLabel')}</div>
          <div className="stat-value tnum">{format.number(data.total)}</div>
          <div className="stat-desc">{data.scope === 'program' ? t('totalDesc', { program: data.program ?? '' }) : t('statOverall')}</div>
        </div>
      </div>
    </div>
  )
}
