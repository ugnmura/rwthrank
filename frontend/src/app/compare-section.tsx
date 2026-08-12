'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { compareOptions } from '@/lib/compare-options'
import {
  useComparison,
  useCompareOptions,
  useMyCourses,
  type CompareFilters,
} from '@/lib/rank'
import { Stat, StatGrid } from './stat-grid'

/**
 * Compare yourself over exactly the classes you choose.
 *
 * Averages are credit-weighted, the way a Gesamtnote is, so the number here is
 * the same kind of number as the one on the transcript. Everyone in the cohort
 * is measured with whatever filter is on screen, so the comparison is always
 * like for like.
 */
export function CompareSection() {
  const t = useTranslations('compare')
  const format = useFormatter()
  const locale = useLocale()

  const { data: results } = useMyCourses()
  const { data: options } = useCompareOptions()

  // Opened from a class on the dashboard, the page starts on that class rather
  // than making the reader find it again in the list below.
  const params = useSearchParams()
  const [semester, setSemester] = useState(params.get('semester') ?? '')
  const [picked, setPicked] = useState<string[]>(params.getAll('course'))

  const { semesters, courses } = useMemo(
    () => compareOptions(results, options?.semesters, locale),
    [results, options, locale]
  )

  const filters: CompareFilters = {
    // Always every semester: the page does not offer to narrow by one.
    studySemester: -1,
    semesters: semester ? [semester] : undefined,
    courses: picked.length ? picked : undefined,
  }

  const { data, isFetching } = useComparison(filters)

  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <section className="flex flex-col gap-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-base-content/60">
              {t('intro')}
            </p>
          </div>

          {/* The answer sits above the controls, so changing one shows its
              effect without scrolling. */}
          <section className={isFetching ? 'opacity-60 transition-opacity' : undefined}>
            {!data || data.total === 0 ? (
              <p className="text-sm text-base-content/60">{t('emptyCohort')}</p>
            ) : data.average == null ? (
              // A selection you have nothing in is still worth an answer: the
              // people who do have something in it are the reason to look.
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
                  {t('cohortAverage')}
                </p>
                <h2 className="tnum font-display text-4xl font-bold tracking-tight sm:text-5xl">
                  {data.cohortAverage ? grade(data.cohortAverage) : '—'}
                </h2>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-base-content/60">
                  {data.cohortAverage ? t('notMine') : t('tooFew')}
                </p>

                <StatGrid columns="three" className="mt-6">
                  <Stat
                    label={t('cohortMedian')}
                    value={data.cohortMedian ? grade(data.cohortMedian) : '—'}
                    hint={data.cohortMedian ? t('medianDesc') : t('tooFew')}
                  />
                  <Stat
                    label={t('people')}
                    value={format.number(data.total)}
                    hint={t('peopleDesc')}
                  />
                  <Stat label={t('yourAverage')} value="—" hint={t('emptyShort')} />
                </StatGrid>
              </>
            ) : (
              <>
                {/* The question is where you stand, so that is the headline. The
                    average is what produced it and sits with the other figures. */}
                <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
                  {t('placeLabel')}
                </p>
                <h2 className="tnum font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
                  {t('place', {
                    rank: format.number(data.rank ?? 0),
                    total: format.number(data.total),
                  })}
                </h2>
                <p className="mt-1 text-sm text-base-content/60">
                  {t('top', { percentile: format.number(data.percentile ?? 0) })} ·{' '}
                  {t('placeDesc')}
                </p>

                <StatGrid columns="four" className="mt-6">
                  <Stat
                    label={t('yourAverage')}
                    value={grade(data.average)}
                    hint={data.official ? t('officialShort') : t('computedShort')}
                    tone="accent"
                  />
                  {/* Withheld rather than missing when the group is one
                      person: an average over one is that person's grade. */}
                  <Stat
                    label={t('cohortAverage')}
                    value={data.cohortAverage ? grade(data.cohortAverage) : '—'}
                    hint={data.cohortAverage ? t('cohortDesc') : t('tooFew')}
                  />
                  <Stat
                    label={t('cohortMedian')}
                    value={data.cohortMedian ? grade(data.cohortMedian) : '—'}
                    hint={data.cohortMedian ? t('medianDesc') : t('tooFew')}
                  />
                  <Stat
                    label={t('counted')}
                    value={format.number(data.courses)}
                    hint={t('countedDesc', { credits: format.number(data.credits) })}
                  />
                </StatGrid>
              </>
            )}
          </section>

          <section className="space-y-5 border-t border-base-300 pt-6">

            <Field label={t('calendarSemester')} hint={t('anySemesterHint')}>
              <select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="select select-sm bg-base-200"
              >
                <option value="">{t('anySemester')}</option>
                {semesters.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>



            <Field label={t('classes')} hint={t('classesHint')}>
              <ClassPicker courses={courses} picked={picked} onChange={setPicked} />
            </Field>
          </section>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
        {label}
      </p>
      <p className="mt-1 mb-2 text-xs text-base-content/50">{hint}</p>
      {children}
    </div>
  )
}

/**
 * Picks classes by typing, not by scanning a wall of them.
 *
 * A degree is dozens of classes and this list only grows, so the control is a
 * search box with the chosen ones kept as chips above it. Nothing is shown
 * until something is typed, which keeps the page quiet by default.
 */
function ClassPicker({
  courses,
  picked,
  onChange,
}: {
  courses: { id: string; name: string }[]
  picked: string[]
  onChange: (next: string[]) => void
}) {
  const t = useTranslations('compare')
  const [query, setQuery] = useState('')

  const chosen = courses.filter((course) => picked.includes(course.id))
  const matches = query.trim()
    ? courses
        .filter((course) => !picked.includes(course.id))
        .filter((course) => course.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : []

  const add = (id: string) => {
    onChange([...picked, id])
    setQuery('')
  }

  return (
    <div>
      {chosen.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {chosen.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                onClick={() => onChange(picked.filter((id) => id !== course.id))}
                className="badge badge-primary gap-1"
                aria-label={t('removeClass', { name: course.name })}
              >
                {course.name}
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchClasses')}
        className="input input-sm w-full bg-base-200"
        // A datalist would hand the filtering to the browser, but then the
        // matches cannot say when there are none.
        autoComplete="off"
      />

      {query.trim() && (
        <ul className="mt-2 max-h-56 overflow-y-auto border border-base-300">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-base-content/50">{t('noMatches')}</li>
          ) : (
            matches.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  onClick={() => add(course.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-base-200"
                >
                  {course.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
