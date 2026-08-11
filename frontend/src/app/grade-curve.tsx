'use client'

import { useFormatter, useTranslations } from 'next-intl'

/**
 * Shares in percent, summing to 100.
 *
 * The German scale is not continuous: only these eleven marks exist, and nothing
 * sits between 4.0 and 5.0. The chart draws the real steps, gap included.
 */
const DISTRIBUTION = [
  { grade: 1.0, share: 3 },
  { grade: 1.3, share: 5 },
  { grade: 1.7, share: 9 },
  { grade: 2.0, share: 13 },
  { grade: 2.3, share: 16 },
  { grade: 2.7, share: 15 },
  { grade: 3.0, share: 12 },
  { grade: 3.3, share: 9 },
  { grade: 3.7, share: 6 },
  { grade: 4.0, share: 5 },
  { grade: 5.0, share: 7 },
]

const SAMPLE_SIZE = 1240
const FAIL = 5.0
const AXIS_MAX = 20
const GRIDLINES = [20, 10, 0]

export function GradeCurve() {
  const t = useTranslations('curve')
  const format = useFormatter()

  // "1,0" and "16 %" for a German reader, "1.0" and "16%" for an English one.
  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const percent = (value: number) => format.number(value / 100, { style: 'percent' })

  return (
    <figure className="border border-base-300">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-base-300 bg-base-200 px-4 py-2">
        <h3 className="font-bold">{t('title')}</h3>
        <span className="tnum text-sm text-base-content/70">
          {t('subtitle', { count: format.number(SAMPLE_SIZE) })}
        </span>
      </figcaption>

      <div className="px-4 py-4">
        <div className="flex gap-2" role="img" aria-label={t('alt')}>
          <div className="tnum flex h-40 w-10 shrink-0 flex-col justify-between text-right text-xs text-base-content/60">
            {GRIDLINES.map((value) => (
              <span key={value}>{percent(value)}</span>
            ))}
          </div>

          <div className="relative h-40 flex-1">
            {GRIDLINES.map((value) => (
              <div
                key={value}
                className="absolute inset-x-0 border-t border-base-300"
                style={{ top: `${((AXIS_MAX - value) / AXIS_MAX) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-[3px]">
              {DISTRIBUTION.map((bin) => (
                <div
                  key={bin.grade}
                  title={`${grade(bin.grade)} · ${percent(bin.share)}`}
                  className={`flex-1 ${bin.grade === FAIL ? 'ml-5 bg-error' : 'bg-primary'}`}
                  style={{ height: `${(bin.share / AXIS_MAX) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-1 flex gap-2">
          <div className="w-10 shrink-0" />
          <div className="tnum flex flex-1 gap-[3px] text-xs text-base-content/70">
            {DISTRIBUTION.map((bin) => (
              <span
                key={bin.grade}
                className={`flex-1 text-center ${bin.grade === FAIL ? 'ml-5' : ''}`}
              >
                {grade(bin.grade)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-base-300 px-4 py-3 text-sm text-base-content/70">
        <p>{t('note')}</p>
        <p>{t('pending')}</p>
      </div>
    </figure>
  )
}
