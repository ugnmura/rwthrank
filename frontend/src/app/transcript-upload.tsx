'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

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

  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const upload = useUploadTranscript()

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

        {upload.error && !collision && (
          <div role="alert" className="alert alert-error alert-soft">
            {upload.error.message}
          </div>
        )}

        {upload.isSuccess && (
          <div role="status" className="alert alert-success alert-soft">
            {t('applied')}
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

