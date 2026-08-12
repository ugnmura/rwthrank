import { describe, expect, test } from 'bun:test'

import { parseGrade, BEST_GRADE, WORST_GRADE, GRADES, PROGRAMS, DEGREES } from '@/lib/study'

describe('parseGrade', () => {
  test('reads the German notation people actually type', () => {
    expect(parseGrade('1,6')).toBe(1.6)
    expect(parseGrade('2,0')).toBe(2)
    expect(parseGrade('1,05')).toBe(1.05)
  })

  test('reads the dotted notation too', () => {
    expect(parseGrade('1.6')).toBe(1.6)
    expect(parseGrade('3')).toBe(3)
  })

  test('ignores surrounding whitespace', () => {
    expect(parseGrade('  2,3  ')).toBe(2.3)
    expect(parseGrade('\t1,0\n')).toBe(1)
  })

  test('accepts both ends of the scale', () => {
    expect(parseGrade('1,0')).toBe(BEST_GRADE)
    expect(parseGrade('5,0')).toBe(WORST_GRADE)
  })

  test('refuses grades off the scale', () => {
    expect(parseGrade('0,9')).toBeNull()
    expect(parseGrade('5,1')).toBeNull()
    expect(parseGrade('6,0')).toBeNull()
    expect(parseGrade('0')).toBeNull()
  })

  test('refuses more precision than a grade has', () => {
    expect(parseGrade('1,234')).toBeNull()
    expect(parseGrade('1.0000')).toBeNull()
  })

  test('refuses anything that is not a number', () => {
    for (const input of ['', ' ', 'sehr gut', '1,6a', 'NaN', 'Infinity', '1e0', '--1']) {
      expect(parseGrade(input)).toBeNull()
    }
  })

  test('refuses signs and separators that would slip past Number()', () => {
    // Number('-1') is -1 and Number(' 1 ') is 1; the pattern has to reject
    // these before the range check ever sees them.
    expect(parseGrade('-1,0')).toBeNull()
    expect(parseGrade('+1,0')).toBeNull()
    expect(parseGrade('1,,6')).toBeNull()
    expect(parseGrade('1.6.6')).toBeNull()
    expect(parseGrade('١,٦')).toBeNull() // Arabic-Indic digits
  })

  test('every mark a module can carry parses back to itself', () => {
    for (const grade of GRADES) {
      expect(parseGrade(grade.toFixed(1).replace('.', ','))).toBe(grade)
    }
  })
})

describe('the fixed vocabulary', () => {
  test('programmes are stored verbatim, so none may be empty or duplicated', () => {
    expect(new Set(PROGRAMS).size).toBe(PROGRAMS.length)
    for (const program of PROGRAMS) expect(program.trim()).toBe(program)
  })

  test('a degree is one of exactly two things', () => {
    expect([...DEGREES]).toEqual(['Bachelor', 'Master'])
  })

  test('the module marks skip 4,3 and 4,7, which the German scale has no room for', () => {
    expect(GRADES).not.toContain(4.3)
    expect(GRADES).not.toContain(4.7)
    expect(GRADES[GRADES.length - 1]).toBe(5)
  })
})
