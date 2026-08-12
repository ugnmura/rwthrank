'use client'

import Link from 'next/link'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { useResults } from '@/lib/rank'

/**
 * Every class on one transcript, with the grade for each.
 *
 * A module passed without a grade has none to show — the German "B" — so the
 * column is empty rather than carrying a number that was never awarded.
 */
export function TranscriptModules({ transcript }: { transcript: string }) {
  const t = useTranslations('modules')
  const format = useFormatter()
  const locale = useLocale()
  const { data: results, isPending } = useResults(transcript)

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
            <tr key={row.id} className="hover:bg-base-200">
              {/* The document names every class twice; show the half the
                  reader asked for, falling back when it was never read. */}
              <td>
                <Link
                  href={`/dashboard/compare?course=${row.course}&studySemester=-1`}
                  className="link link-hover"
                  title={t('compareThis')}
                >
                  {(locale === 'en' && row.expand?.course?.nameEn) ||
                    row.expand?.course?.name ||
                    '—'}
                </Link>
              </td>
              <td className="tnum text-right">
                {row.grade ? number(row.grade) : <span title={t('ungradedPass')}>{t('passed')}</span>}
              </td>
              <td className="tnum text-right">{row.credits ? format.number(row.credits) : '—'}</td>
              <td className="text-right text-base-content/60">{row.semester || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

