import PocketBase from 'pocketbase'

import type { TypedPocketBase } from '@/types/pocketbase'

// The browser talks to PocketBase directly, so this URL has to resolve from the
// user's machine. Inside compose that means the published port on localhost —
// the "backend" service name only works between containers.
export const pb = new PocketBase(
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? 'http://127.0.0.1:8090'
) as TypedPocketBase
