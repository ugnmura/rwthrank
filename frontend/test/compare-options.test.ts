import { describe, expect, test } from 'bun:test'

import { compareOptions } from '@/lib/compare-options'
import type { Result } from '@/lib/rank'

function result(partial: Partial<Result> & { course: string }): Result {
  return {
    id: 'r' + partial.course,
    grade: 2,
    passed: true,
    credits: 6,
    semester: '24S',
    ...partial,
  }
}

const analysis = result({
  course: 'c1',
  semester: '23W',
  expand: { course: { name: 'Analysis I', nameEn: 'Calculus I' } },
})
const programming = result({
  course: 'c2',
  semester: '24S',
  expand: { course: { name: 'Programmierung', nameEn: 'Programming' } },
})

describe('compareOptions', () => {
  test('offers semesters nobody in this account has sat', () => {
    const { semesters } = compareOptions([analysis], ['22W', '23W', '25S'], 'de')
    expect(semesters).toEqual(['22W', '23W', '25S'])
  })

  test('a semester on your transcript survives even if the server list misses it', () => {
    const { semesters } = compareOptions([analysis], ['24S'], 'de')
    expect(semesters).toContain('23W')
  })

  test('semesters come back sorted, and the string order is the real order', () => {
    const { semesters } = compareOptions([], ['24W', '23W', '25S', '24S'], 'de')
    expect(semesters).toEqual(['23W', '24S', '24W', '25S'])
  })

  test('a result with no semester adds nothing', () => {
    const { semesters } = compareOptions([result({ course: 'c9', semester: '' })], [], 'de')
    expect(semesters).toEqual([])
  })

  test('nothing anywhere is empty rather than undefined', () => {
    expect(compareOptions(undefined, undefined, 'de')).toEqual({ semesters: [], courses: [] })
  })

  test('classes use the German name by default', () => {
    const { courses } = compareOptions([analysis, programming], [], 'de')
    expect(courses.map((course) => course.name)).toEqual(['Analysis I', 'Programmierung'])
  })

  test('and the English one for an English reader', () => {
    const { courses } = compareOptions([analysis, programming], [], 'en')
    expect(courses.map((course) => course.name)).toEqual(['Calculus I', 'Programming'])
  })

  test('a class with no English name keeps the German one rather than disappearing', () => {
    const untranslated = result({
      course: 'c3',
      expand: { course: { name: 'Proseminar', nameEn: '' } },
    })
    const { courses } = compareOptions([untranslated], [], 'en')
    expect(courses).toEqual([{ id: 'c3', name: 'Proseminar' }])
  })

  test('a class sat twice is offered once', () => {
    const retake = { ...analysis, id: 'r-retake', semester: '24W' }
    const { courses } = compareOptions([analysis, retake], [], 'de')
    expect(courses).toHaveLength(1)
  })

  test('a result whose course was not expanded is left out, not listed blank', () => {
    const { courses } = compareOptions([result({ course: 'c4' })], [], 'de')
    expect(courses).toEqual([])
  })

  test('classes sort by name for the locale being read', () => {
    const umlaut = result({ course: 'c5', expand: { course: { name: 'Ökonomie', nameEn: 'Economics' } } })
    const zeta = result({ course: 'c6', expand: { course: { name: 'Zahlentheorie', nameEn: 'Number theory' } } })
    const { courses } = compareOptions([zeta, umlaut], [], 'de')
    // Ö sorts with O in German, so it comes before Z rather than after it.
    expect(courses.map((course) => course.name)).toEqual(['Ökonomie', 'Zahlentheorie'])
  })
})
