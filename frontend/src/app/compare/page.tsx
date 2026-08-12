'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'

import { useComparison, useMyCourses, type CompareFilters } from '@/lib/rank'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'

/**
 * Compare yourself over exactly the classes you choose.
 *
 * Averages are credit-weighted, the way a Gesamtnote is, so the number here is
 * the same kind of number as the one on the transcript. Everyone in the cohort
 * is measured with whatever filter is on screen, so the comparison is always
 * like for like.
 */
export default function ComparePage() {
  const t = useTranslations('compare')
  const format = useFormatter()
  const locale = useLocale()

  const { data: results } = useMyCourses()

  const [studySemester, setStudySemester] = useState(0)
  const [semester, setSemester] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [credits, setCredits] = useState('')
  const [ownProgram, setOwnProgram] = useState(true)

  // Built from what the person actually has, so no filter can select nothing.
  const { semesters, courses, creditSizes } = useMemo(() => {
    const sem = new Set<string>()
    const cp = new Set<number>()
    const byCourse = new Map<string, string>()

    for (const row of results ?? []) {
      if (row.semester) sem.add(row.semester)
      if (row.credits) cp.add(row.credits)
      const name =
        (locale === 'en' && row.expand?.course?.nameEn) || row.expand?.course?.name || ''
      if (name) byCourse.set(row.course, name)
    }

    return {
      semesters: [...sem].sort(),
      creditSizes: [...cp].sort((a, b) => a - b),
      courses: [...byCourse].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    }
  }, [results, locale])

  const filters: CompareFilters = {
    studySemester,
    semesters: semester ? [semester] : undefined,
    courses: picked.length ? picked : undefined,
    minCredits: credits ? Number(credits) : undefined,
    maxCredits: credits ? Number(credits) : undefined,
    ...(ownProgram ? {} : { program: '', degree: '' }),
  }

  const { data, isFetching } = useComparison(filters)

  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:px-10">
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
            <Field label={t('studySemester')} hint={t('studySemesterHint')}>
              <select
                value={studySemester}
                onChange={(event) => setStudySemester(Number(event.target.value))}
                className="select select-sm bg-base-200"
              >
                <option value={0}>{t('mySemester')}</option>
                <option value={-1}>{t('allSemesters')}</option>
                {semesters.map((_, index) => (
                  <option key={index} value={index + 1}>
                    {t('nthSemester', { n: index + 1 })}
                  </option>
                ))}
              </select>
            </Field>

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

            <Field label={t('creditSize')} hint={t('creditSizeHint')}>
              <select
                value={credits}
                onChange={(event) => setCredits(event.target.value)}
                className="select select-sm bg-base-200"
              >
                <option value="">{t('anyCredits')}</option>
                {creditSizes.map((value) => (
                  <option key={value} value={value}>
                    {t('cpValue', { credits: format.number(value) })}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('cohort')} hint={t('cohortHint')}>
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  checked={ownProgram}
                  onChange={(event) => setOwnProgram(event.target.checked)}
                  className="checkbox checkbox-sm"
                />
                <span className="label-text">{t('ownProgramOnly')}</span>
              </label>
            </Field>

            <Field label={t('classes')} hint={t('classesHint')}>
              <div className="flex flex-wrap gap-2">
                {picked.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPicked([])}
                    className="btn btn-xs btn-ghost"
                  >
                    {t('clearClasses')}
                  </button>
                )}
                {courses.map((course) => {
                  const on = picked.includes(course.id)

                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() =>
                        setPicked(
                          on ? picked.filter((id) => id !== course.id) : [...picked, course.id]
                        )
                      }
                      className={`btn btn-xs ${on ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {course.name}
                    </button>
                  )
                })}
              </div>
            </Field>
          </section>
        </main>
      </SignedInOnly>
    </div>
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
