'use client'

import { useFormatter, useTranslations } from 'next-intl'

/**
 * The German grading scale is not continuous — only these eleven marks exist,
 * with nothing between 4.0 and 5.0. Drawing the real steps (and the gap) says
 * more about what this product measures than a smooth bell curve would.
 */
const DISTRIBUTION = [
  { grade: 1.0, share: 4 },
  { grade: 1.3, share: 7 },
  { grade: 1.7, share: 12 },
  { grade: 2.0, share: 17 },
  { grade: 2.3, share: 21 },
  { grade: 2.7, share: 19 },
  { grade: 3.0, share: 15 },
  { grade: 3.3, share: 11 },
  { grade: 3.7, share: 8 },
  { grade: 4.0, share: 6 },
  { grade: 5.0, share: 9 },
]

const PEAK = Math.max(...DISTRIBUTION.map((bin) => bin.share))
const FAIL = 5.0

export function GradeCurve() {
  const t = useTranslations('curve')
  const format = useFormatter()

  // "1,0" for a German reader, "1.0" for an English one.
  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <figure role="img" aria-label={t('alt')} className="w-full">
      <div className="flex h-32 items-end gap-[2px] sm:h-44 sm:gap-1">
        {DISTRIBUTION.map((bin, index) => (
          <div
            key={bin.grade}
            className={[
              'flex-1',
              // 5.0 is the failing mark, and it sits across the gap where 4.3
              // and 4.7 would be if they existed.
              bin.grade === FAIL ? 'ml-4 bg-error/55 sm:ml-8' : 'bg-primary/80',
            ].join(' ')}
            style={{
              height: `${(bin.share / PEAK) * 100}%`,
              animationDelay: `${index * 35}ms`,
            }}
          >
            <span className="bar block h-full w-full" />
          </div>
        ))}
      </div>

      <div className="mt-px h-px w-full bg-base-content/25" />

      <div className="mt-2 flex gap-[2px] font-mono text-[10px] text-base-content/45 sm:gap-1 sm:text-xs">
        {DISTRIBUTION.map((bin) => (
          <span
            key={bin.grade}
            className={`tnum flex-1 text-center ${bin.grade === FAIL ? 'ml-4 sm:ml-8' : ''}`}
          >
            {grade(bin.grade)}
          </span>
        ))}
      </div>

      {/* Your own position: unknown, and honestly drawn that way. */}
      <div className="mt-5 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.18em] text-secondary uppercase">
          {t('you')}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-secondary/60" />
        <span className="tnum font-mono text-xs text-secondary">?</span>
      </div>

      <figcaption className="mt-2 max-w-xl text-xs leading-relaxed text-base-content/45">
        {t('caption')}
      </figcaption>
    </figure>
  )
}
