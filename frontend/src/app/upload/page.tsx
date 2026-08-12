'use client'

import { TranscriptUpload } from '../transcript-upload'
import { SignedInOnly } from '../signed-in-only'
import { SiteHeader } from '../site-header'

export default function UploadPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <SiteHeader />
      <SignedInOnly>
        <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:px-10">
          <TranscriptUpload />
        </main>
      </SignedInOnly>
    </div>
  )
}
