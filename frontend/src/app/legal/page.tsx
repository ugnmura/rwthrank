'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { LocaleSwitcher } from '../locale-switcher'
import { ThemeSwitcher } from '../theme-switcher'

/**
 * Impressum and Datenschutzerklärung on one page.
 *
 * Both are legally required in Germany the moment a site like this is reachable
 * and stores an email address. They are kept together because the site is small
 * and one link is easier to find than two.
 *
 * The operator's name and address are the only parts that cannot be written
 * here: §5 DDG requires a real, reachable postal address.
 */
export default function LegalPage() {
  const t = useTranslations('legal')

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-baseline justify-between gap-4 px-6 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase sm:px-10">
        <Link href="/" className="text-base-content/70 hover:underline">
          rwthrank
        </Link>
        <div className="flex items-baseline gap-4">
          <ThemeSwitcher />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t('title')}
        </h1>

        <Section title={t('imprintTitle')}>
          <p className="whitespace-pre-line">{t('imprintBody')}</p>
        </Section>

        <Section title={t('controllerTitle')}>
          <p>{t('controllerBody')}</p>
        </Section>

        <Section title={t('dataTitle')}>
          <p>{t('dataBody')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('dataEmail')}</li>
            <li>{t('dataProfile')}</li>
            <li>{t('dataTranscript')}</li>
            <li>{t('dataLogs')}</li>
          </ul>
        </Section>

        <Section title={t('basisTitle')}>
          <p>{t('basisBody')}</p>
        </Section>

        <Section title={t('processorsTitle')}>
          <p>{t('processorsBody')}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t('processorHetzner')}</li>
            <li>{t('processorCloudflare')}</li>
            <li>{t('processorGithub')}</li>
            <li>{t('processorResend')}</li>
          </ul>
        </Section>

        <Section title={t('storageTitle')}>
          <p>{t('storageBody')}</p>
        </Section>

        <Section title={t('retentionTitle')}>
          <p>{t('retentionBody')}</p>
        </Section>

        <Section title={t('rightsTitle')}>
          <p>{t('rightsBody')}</p>
        </Section>

        <Section title={t('trackingTitle')}>
          <p>{t('trackingBody')}</p>
        </Section>

        <p className="mt-10 text-xs text-base-content/45">{t('updated')}</p>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <div className="text-sm leading-relaxed text-base-content/75">{children}</div>
    </section>
  )
}
