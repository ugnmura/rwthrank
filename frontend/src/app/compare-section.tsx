'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { useComparison, useMyCourses, type CompareFilters } from '@/lib/rank'

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

  // Opened from a class on the dashboard, the page starts on that class rather
  // than making the reader find it again in the list below.
  const params = useSearchParams()
  const [semester, setSemester] = useState(params.get('semester') ?? '')
  const [picked, setPicked] = useState<string[]>(params.getAll('course'))

  // Built from what the person actually has, so no filter can select nothing.
  const { semesters, courses } = useMemo(() => {
    const sem = new Set<string>()
    const byCourse = new Map<string, string>()

    for (const row of results ?? []) {
      if (row.semester) sem.add(row.semester)
      const name =
        (locale === 'en' && row.expand?.course?.nameEn) || row.expand?.course?.name || ''
      if (name) byCourse.set(row.course, name)
    }

    return {
      semesters: [...sem].sort(),
      courses: [...byCourse].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [results, locale])

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
            {data?.average == null ? (
              <p className="text-sm text-base-content/60">{t('empty')}</p>
            ) : (
              <>
                <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
                  {t('yourAverage')}
                </p>
                <p className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                  {grade(data.average)}
                </p>
                <p className="mt-1 text-xs text-base-content/50">
                  {data.official ? t('official') : t('computed')}
                </p>
                <div className="stats stats-vertical sm:stats-horizontal mt-4 w-full border border-base-300">
                  <div className="stat">
                    <div className="stat-title">{t('rank')}</div>
                    <div className="stat-value tnum text-2xl">
                      {t('rankValue', {
                        rank: format.number(data.rank ?? 0),
                        total: format.number(data.total),
                      })}
                    </div>
                    <div className="stat-desc">
                      {t('top', { percentile: format.number(data.percentile ?? 0) })}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">{t('cohortAverage')}</div>
                    <div className="stat-value tnum text-2xl">
                      {data.cohortAverage ? grade(data.cohortAverage) : '—'}
                    </div>
                    <div className="stat-desc">{t('cohortDesc')}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">{t('cohortMedian')}</div>
                    <div className="stat-value tnum text-2xl">
                      {data.cohortMedian ? grade(data.cohortMedian) : '—'}
                    </div>
                    <div className="stat-desc">{t('medianDesc')}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">{t('counted')}</div>
                    <div className="stat-value tnum text-2xl">{format.number(data.courses)}</div>
                    <div className="stat-desc">
                      {t('countedDesc', { credits: format.number(data.credits) })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="space-y-5 border-t border-base-300 pt-6">

            <Field label={t('calendarSemester')} hint={t('calendarSemesterHint')}>
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
