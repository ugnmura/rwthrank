'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'

import { useAuthRecord } from '@/lib/auth'
import { pb } from '@/lib/pocketbase'
import { SignedInOnly } from '../../signed-in-only'
import { SiteHeader } from '../../site-header'

/**
 * Account settings, which for now is one thing: getting rid of it.
 *
 * Deleting is asked twice on purpose. It takes the account, every transcript,
 * every uploaded file and every grade read from them, and none of it can be
 * recovered — the second question is the one that makes it hard to do by
 * accident, so it asks the address to be typed rather than offering a button.
 */
export default function SettingsPage() {
  const t = useTranslations('settings')
  const { data: user } = useAuthRecord()
  const router = useRouter()

  const first = useRef<HTMLDialogElement>(null)
  const second = useRef<HTMLDialogElement>(null)
  const [typed, setTyped] = useState('')

  const remove = useMutation({
    mutationFn: () => pb.collection('users').delete(pb.authStore.record!.id),
    onSuccess: () => {
      pb.authStore.clear()
      router.replace('/')
    },
  })

  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h1>

          <section className="mt-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-base-content/45 uppercase">
              {t('accountLabel')}
            </p>
            <p className="mt-1 font-medium break-all">{user?.email}</p>
          </section>

          <section className="mt-10 border border-error/40 p-5">
            <h2 className="text-lg font-bold text-error">{t('dangerTitle')}</h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-base-content/70">
              {t('dangerBody')}
            </p>
            <button
              type="button"
              onClick={() => first.current?.showModal()}
              className="btn btn-outline btn-error btn-sm mt-4"
            >
              {t('delete')}
            </button>
          </section>
        </main>
      </SignedInOnly>

      {/* First: what goes. */}
      <dialog ref={first} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">{t('confirm1Title')}</h3>
          <p className="py-3 text-sm leading-relaxed text-base-content/70">{t('confirm1Body')}</p>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost btn-sm">{t('cancel')}</button>
            </form>
            <button
              type="button"
              onClick={() => {
                first.current?.close()
                setTyped('')
                second.current?.showModal()
              }}
              className="btn btn-error btn-sm"
            >
              {t('continue')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('cancel')}</button>
        </form>
      </dialog>

      {/* Second: prove it was meant. */}
      <dialog ref={second} className="modal">
        <div className="modal-box">
          <h3 className="text-lg font-bold">{t('confirm2Title')}</h3>
          <p className="py-3 text-sm leading-relaxed text-base-content/70">
            {t('confirm2Body', { email: user?.email ?? '' })}
          </p>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={user?.email}
            className="input w-full bg-base-200"
            autoComplete="off"
          />

          {remove.error && (
            <p role="alert" className="mt-2 text-sm text-error">
              {remove.error.message}
            </p>
          )}

          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost btn-sm">{t('cancel')}</button>
            </form>
            <button
              type="button"
              disabled={typed.trim() !== user?.email || remove.isPending}
              onClick={() => remove.mutate()}
              className="btn btn-error btn-sm"
            >
              {remove.isPending && <span className="loading loading-spinner loading-xs" />}
              {remove.isPending ? t('deleting') : t('deleteForever')}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>{t('cancel')}</button>
        </form>
      </dialog>
    </div>
  )
}
