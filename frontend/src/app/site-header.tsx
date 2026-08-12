'use client'

import Link from 'next/link'

import { AuthButton } from './auth-button'
import { LocaleSwitcher } from './locale-switcher'
import { ThemeSwitcher } from './theme-switcher'
import { Breadcrumbs } from './breadcrumbs'
import { MobileMenu } from './mobile-menu'

/**
 * The header every page shares.
 *
 * Only the wordmark on the left: the site is two screens deep, the breadcrumbs
 * below already say where you are, and the account menu already lists where you
 * can go. A row of links on top of both was saying it a third time.
 */
export function SiteHeader() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-x-6 px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-base-content/70 hover:underline">
          <Mark />
          rwthrank
        </Link>

        <div className="hidden items-center gap-4 sm:flex">
          <ThemeSwitcher />
          <LocaleSwitcher />
          <AuthButton />
        </div>
        <MobileMenu />
      </header>
      <Breadcrumbs />
    </>
  )
}

/**
 * The same chart as the tab icon, drawn in the current text colour so it follows
 * whichever theme is on rather than carrying its own palette into the header.
 */
function Mark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-4 w-4 shrink-0">
      <g fill="currentColor">
        <rect x="5" y="18" width="3.5" height="7" rx="1.75" />
        <rect x="10" y="13" width="3.5" height="12" rx="1.75" />
        <rect x="15" y="8" width="3.5" height="17" rx="1.75" />
        <rect x="20" y="15" width="3.5" height="10" rx="1.75" />
      </g>
      <rect x="25.5" y="20" width="3.5" height="5" rx="1.75" fill="var(--color-secondary)" />
    </svg>
  )
}
