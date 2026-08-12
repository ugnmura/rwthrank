'use client'

import { Fragment, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import { useCourseRank, useResults } from '@/lib/rank'

/**
 * Every class on one transcript, with the grade for each.
 *
 * A module passed without a grade has none to show — the German "B" — so the
 * column is empty rather than carrying a number that was never awarded.
 */
export function TranscriptModules({ transcript }: { transcript: string }) {
  const t = useTranslations('modules')
  const format = useFormatter()
  const { data: results, isPending } = useResults(transcript)
  // One class open at a time; its standing is only fetched when opened.
  const [openCourse, setOpenCourse] = useState<string>()

  if (isPending) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-base-content/50">
        <span className="loading loading-spinner loading-xs" />
        {t('loading')}
      </p>
    )
  }

  // The placeholder a typed grade creates has no document behind it.
  if (!results?.length) {
    return <p className="mt-3 text-sm text-base-content/50">{t('none')}</p>
  }

  const number = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="table-zebra table table-sm">
        <thead>
          <tr>
            <th>{t('course')}</th>
            <th className="text-right">{t('grade')}</th>
            <th className="text-right">{t('credits')}</th>
            <th className="text-right">{t('semester')}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <Fragment key={row.id}>
            <tr
              onClick={() => setOpenCourse(openCourse === row.course ? undefined : row.course)}
              className="cursor-pointer hover:bg-base-200"
            >
              <td>{row.expand?.course?.name ?? '—'}</td>
              <td className="tnum text-right">
                {row.grade ? number(row.grade) : <span title={t('ungradedPass')}>{t('passed')}</span>}
              </td>
              <td className="tnum text-right">{row.credits ? format.number(row.credits) : '—'}</td>
              <td className="text-right text-base-content/60">{row.semester || '—'}</td>
            </tr>
            {openCourse === row.course && (
              <tr>
                <td colSpan={4} className="bg-base-200/60">
                  <CourseStanding course={row.course} />
                </td>
              </tr>
            )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** How the caller did in one class, against everyone who sat it. */
function CourseStanding({ course }: { course: string }) {
  const t = useTranslations('modules')
  const format = useFormatter()
  const { data, isPending } = useCourseRank(course)

  if (isPending) {
    return (
      <span className="flex items-center gap-2 text-sm text-base-content/50">
        <span className="loading loading-spinner loading-xs" />
        {t('loading')}
      </span>
    )
  }
  if (!data?.rank) return <span className="text-sm text-base-content/50">{t('noStanding')}</span>

  return (
    <span className="tnum text-sm">
      {t('standing', {
        rank: format.number(data.rank),
        total: format.number(data.total),
        percentile: format.number(data.percentile ?? 0, { maximumFractionDigits: 1 }),
      })}
    </span>
  )
}
