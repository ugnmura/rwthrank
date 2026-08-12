import type { Result } from './rank'

export type ClassOption = { id: string; name: string }

/**
 * What the compare page can be narrowed to.
 *
 * Semesters come from everyone — a semester you have not sat is still worth
 * asking about — while classes stay your own, because a class you never took
 * has no comparison to make.
 *
 * Kept apart from the component so the awkward parts are checkable on their
 * own: a result with no semester, a class with no English name in English, the
 * same class sat twice, and a sort that has to hold for both.
 */
export function compareOptions(
  results: Result[] | undefined,
  everyonesSemesters: string[] | undefined,
  locale: string
): { semesters: string[]; courses: ClassOption[] } {
  const semesters = new Set<string>(everyonesSemesters ?? [])
  const byCourse = new Map<string, string>()

  for (const row of results ?? []) {
    if (row.semester) semesters.add(row.semester)

    const name =
      (locale === 'en' && row.expand?.course?.nameEn) || row.expand?.course?.name || ''
    if (name) byCourse.set(row.course, name)
  }

  return {
    semesters: [...semesters].sort(),
    courses: [...byCourse]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
