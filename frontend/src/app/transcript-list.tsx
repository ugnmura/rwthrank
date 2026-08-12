'use client'

import { useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { TrashIcon } from '@heroicons/react/24/outline'

import { useDeleteTranscript, useTranscripts, type StoredTranscript } from '@/lib/rank'

/**
 * The transcripts a user has uploaded, with a way to remove them.
 *
 * The privacy policy says an upload can be deleted at any time, so this is what
 * makes that true rather than aspirational. Deleting is confirmed first: it also
 * removes every module read from the document, and nothing can bring those back
 * except uploading the PDF again.
 */
export function TranscriptList() {
  const t = useTranslations('transcripts')
  const format = useFormatter()
  const { data: transcripts } = useTranscripts()
  const remove = useDeleteTranscript()

  const [pending, setPending] = useState<StoredTranscript | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  if (!transcripts?.length) return null

  const grade = (value: number) =>
    format.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const ask = (item: StoredTranscript) => {
    setPending(item)
    dialog.current?.showModal()
  }

  const confirm = () => {
    if (!pending) return
    remove.mutate(pending.id, { onSettled: () => dialog.current?.close() })
  }

  return (
    <section>
      <p className="mb-3 font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
        {t('label')}
      </p>

      <ul className="space-y-2">
        {transcripts.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-base-300 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {item.program || t('unknownProgram')}
                {item.degree ? ` · ${item.degree}` : ''}
              </p>
              <p className="tnum text-sm text-base-content/60">
                {t('summary', {
                  grade: grade(item.grade),
                  credits: format.number(item.credits),
                  maxCredits: format.number(item.maxCredits),
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={() => ask(item)}
              aria-label={t('deleteOne', { program: item.program || t('unknownProgram') })}
              title={t('delete')}
              className="btn btn-sm btn-ghost text-base-content/50 hover:text-error"
            >
              <TrashIcon className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {/* Native dialog, so Escape and the backdrop close it without extra code. */}
      <dialog ref={dialog} className="modal" onClose={() => setPending(null)}>
        <div className="modal-box">
          <h3 className="text-lg font-bold">{t('confirmTitle')}</h3>
          <p className="py-3 text-sm leading-relaxed text-base-content/70">
            {t('confirmBody', { program: pending?.program || t('unknownProgram') })}
          </p>

          {remove.error && (
            <p role="alert" className="pb-2 text-sm text-error">
              {remove.error.message}
            </p>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost btn-sm">{t('cancel')}</button>
            </form>
            <button
              type="button"
              onClick={confirm}
              disabled={remove.isPending}
              className="btn btn-error btn-sm"
            >
              {remove.isPending && <span className="loading loading-spinner loading-xs" />}
              {remove.isPending ? t('deleting') : t('delete')}
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

