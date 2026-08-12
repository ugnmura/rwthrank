'use client'

import { useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

import { useUploadTranscript, WouldReplaceError } from '@/lib/rank'

/**
 * Uploading a Notenspiegel stores it and everything read from it.
 *
 * It is confirmed first, because an upload is not additive: a document for a
 * subject that already has one replaces it, taking the old file and its modules
 * with it. That is destructive enough to ask about, especially since the person
 * cannot see which of their transcripts is about to go until it has been read.
 */
export function TranscriptUpload() {
  const t = useTranslations('upload')
  const format = useFormatter()

  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const upload = useUploadTranscript()

  const parsed = upload.data
  const collision = upload.error instanceof WouldReplaceError ? upload.error : null

  // The picked file is spent once it has been read, so the control goes back to
  // empty and the next upload starts from nothing.
  const clear = () => {
    setFile(null)
    if (input.current) input.current.value = ''
  }

  const send = (replace?: boolean) => {
    if (!file) return

    upload.mutate(
      { file, replace },
      {
        onSuccess: clear,
        onError: (error) => {
          if (error instanceof WouldReplaceError) dialog.current?.showModal()
        },
      }
    )
  }

  return (
    <section className="card card-border border-base-300 bg-base-200/40">
      <div className="card-body gap-4">
        <h2 className="card-title font-display text-xl">{t('title')}</h2>
        <p className="max-w-md text-sm leading-relaxed text-base-content/60">{t('hint')}</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send()
          }}
        >
          <fieldset className="fieldset">
            <legend className="fieldset-legend font-mono text-[11px] tracking-[0.18em] text-base-content/55 uppercase">
              {t('legend')}
            </legend>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              required
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                // A different file makes the previous reading, and the offer
                // that came with it, stale.
                upload.reset()
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

            <div role="status" className="alert alert-success alert-soft mt-4">
              {t('applied')}
            </div>
          </div>
        )}
      </div>

      {/* Native dialog, so Escape and the backdrop close it without extra code. */}
      <dialog ref={dialog} className="modal" onClose={() => upload.reset()}>
        <div className="modal-box">
          <h3 className="text-lg font-bold">{t('confirmTitle')}</h3>
          <p className="py-3 text-sm leading-relaxed text-base-content/70">
            {t('confirmBody', {
              program: collision?.program ?? '',
              degree: collision?.degree ?? '',
            })}
          </p>

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost btn-sm">{t('cancel')}</button>
            </form>
            <button
              type="button"
              onClick={() => {
                dialog.current?.close()
                send(true)
              }}
              className="btn btn-primary btn-sm"
            >
              {t('confirm')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('cancel')}</button>
        </form>
      </dialog>
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
