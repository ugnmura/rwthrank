/**
 * The breadcrumb trail for a path.
 *
 * Pure and separate from the component that draws it: what a path turns into is
 * the part that can be wrong — a trailing slash, a nested route, a segment with
 * no translation — and none of that needs a DOM to check.
 */
export type Crumb = {
  href: string
  label: string
  /** The page you are on. Rendered as text, because a link to here goes nowhere. */
  current: boolean
}

export function crumbsFor(path: string, labels: Record<string, string>): Crumb[] {
  const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)

  return segments.map((segment, index) => ({
    href: '/' + segments.slice(0, index + 1).join('/'),
    // An untranslated segment falls back to itself rather than disappearing:
    // a wrong-looking crumb is easier to notice than a missing one.
    label: labels[segment] ?? segment,
    current: index === segments.length - 1,
  }))
}
