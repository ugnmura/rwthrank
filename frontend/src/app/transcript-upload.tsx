'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import { useSaveProfile, useUploadTranscript } from '@/lib/rank'

/**
 * Reading a transcript is a second, more accurate way to fill in the same two
 * fields. It stays an offer: the server hands back what it read, and the record
 * only changes if the user agrees with it.
 */
export function TranscriptUpload() {
  const t = useTranslations('upload')
  const format = useFormatter()

  const [file, setFile] = useState<File | null>(null)
  const upload = useUploadTranscript()
  const apply = useSaveProfile()

  const parsed = upload.data

  return (
    <section className="card card-border border-base-300 bg-base-200/40">
      <div className="card-body gap-4">
        <h2 className="card-title font-display text-xl">{t('title')}</h2>
        <p className="max-w-md text-sm leading-relaxed text-base-content/60">{t('hint')}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (file) upload.mutate(file)
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
              {t('legend')}
            </legend>
            <input
              type="file"
              accept="application/pdf"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                // A different file makes the previous reading, and the offer
                // that came with it, stale.
                upload.reset()
                apply.reset()
              }}
              className="file-input w-full bg-base-100"
            />
            <p className="fieldset-label">{t('privacy')}</p>
          </fieldset>

          <button
            type="submit"
            disabled={!file || upload.isPending}
            className="btn btn-primary mt-4"
          >
            {upload.isPending ? t('reading') : t('submit')}
          </button>
        </form>

        {upload.error && (
          <div role="alert" className="alert alert-error alert-soft">
            <div>
              <p>{t('error')}</p>
              <p className="mt-1 font-mono text-xs opacity-70">{upload.error.message}</p>
            </div>
          </div>
        )}

        {parsed && (
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
              {t('resultTitle')}
            </p>

            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label={t('program')} value={parsed.program} />
              <Row label={t('degree')} value={parsed.degree} />
              <Row
                label={t('grade')}
                value={format.number(parsed.grade, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              />
              <Row
                label={t('credits')}
                value={t('creditsValue', {
                  credits: format.number(parsed.credits),
                  maxCredits: format.number(parsed.maxCredits),
                })}
              />
              <Row label={t('modules')} value={format.number(parsed.moduleCount)} />
            </dl>

            {apply.isSuccess ? (
              <div role="status" className="alert alert-success alert-soft mt-4">
                {t('applied')}
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  apply.mutate({
                    program: parsed.program,
                    degree: parsed.degree,
                    grade: parsed.grade,
                  })
                }
                disabled={apply.isPending}
                className="btn btn-secondary mt-4"
              >
                {apply.isPending ? t('applying') : t('apply')}
              </button>
            )}

            {apply.error && (
              <p role="alert" className="mt-2 text-sm text-error">
                {apply.error.message}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-base-content/55">{label}</dt>
      <dd className="tnum font-medium">{value}</dd>
    </div>
  )
}
