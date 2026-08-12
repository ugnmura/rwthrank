/**
 * The programs a user can pick. These are stored verbatim on the record and are
 * what the ranking groups by, so they stay out of the message files: translating
 * "Informatik" would change the value we send, not just what a reader sees.
 */
export const PROGRAMS = [
  'Informatik',
  'Maschinenbau',
  'Elektrotechnik',
  'Bauingenieurwesen',
  'Wirtschaftsingenieurwesen',
  'Mathematik',
  'Physik',
  'Chemie',
  'Biologie',
  'Medizin',
  'Psychologie',
  'Architektur',
  'Sonstiges',
] as const

/**
 * The eleven marks a single module can be given. Nothing exists between 4.0 and
 * 5.0. Kept as numbers so `useFormatter` renders 1,0 or 1.0 per locale.
 *
 * The grade asked for at registration is not one of these: a Gesamtnote is an
 * average, so 1,6 and 2,4 are ordinary values. That is why it is typed rather
 * than picked from this list.
 */
export const GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0]

export const BEST_GRADE = 1.0
export const WORST_GRADE = 5.0

/**
 * Reads a typed Gesamtnote, in whichever notation the person reaches for.
 *
 * German writes 1,6 and the record stores 1.6, so the comma has to be accepted
 * rather than corrected after the fact. Returns null when it is not a grade,
 * which is what the form shows its error on.
 */
export function parseGrade(input: string): number | null {
  const cleaned = input.trim().replace(',', '.')
  if (!/^\d(\.\d{1,2})?$/.test(cleaned)) return null

  const value = Number(cleaned)
  if (value < BEST_GRADE || value > WORST_GRADE) return null

  return value
}
