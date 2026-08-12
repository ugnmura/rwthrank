/**
 * The small block of figures under a headline.
 *
 * Not daisyUI's `stats`, which lays its items out in one row and scrolls when
 * they do not fit — a sideways scrollbar hides figures behind a gesture nobody
 * thinks to make, and on a phone that is most of them. This wraps instead, so
 * every figure is on screen at every width.
 *
 * Separators are borders on the cells themselves rather than a coloured gap
 * behind them: an odd number of figures leaves a slot empty in a two-column
 * row, and a gap shows through it as a block of colour with nothing in it.
 */
export function StatGrid({
  columns,
  className = '',
  children,
}: {
  columns: 'three' | 'four'
  className?: string
  children: React.ReactNode
}) {
  const wide = columns === 'three' ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid grid-cols-2 border-t border-l border-base-300 ${wide} ${className}`}>
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint: string
  tone?: 'accent'
}) {
  return (
    <div className="border-r border-b border-base-300 bg-base-100 px-4 py-4 sm:px-5">
      <p className="text-xs text-base-content/50">{label}</p>
      <p
        className={`tnum mt-1 font-display text-2xl font-bold tracking-tight ${
          tone === 'accent' ? 'text-secondary' : ''
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-base-content/45">{hint}</p>
    </div>
  )
}
