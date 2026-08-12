'use client'

import { useRef, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'

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
              <TrashIcon />
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

/** heroicons/outline trash */
function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.74 9l-.35 9m-4.78 0L9.26 9m9.97-3.24c.34.05.68.11 1.02.16M18.23 5.76L17.6 19.2a2.25 2.25 0 01-2.25 2.05H8.65a2.25 2.25 0 01-2.25-2.05L5.77 5.76m12.46 0a48.1 48.1 0 00-3.48-.4m-9 .4c.34-.06.68-.11 1.02-.16m0 0a48.1 48.1 0 013.48-.4m3.75 0V3.87c0-.87-.67-1.6-1.54-1.62a49.3 49.3 0 00-2.42 0c-.87.02-1.54.75-1.54 1.62v1.29m5.5 0a48.7 48.7 0 00-5.5 0" />
    </svg>
  )
}
