# rwthrank frontend

Next.js 16 (App Router) with React Query, daisyUI, and next-intl. Run it with the
rest of the stack via `docker compose up` from the repository root; the notes
below are for working on it alone.

```sh
bun install
bun run dev
```

It expects PocketBase at `NEXT_PUBLIC_POCKETBASE_URL`, defaulting to
`http://127.0.0.1:8090`. That value is read by the browser, so in Docker it has
to be the published port rather than the `backend` service name.

## Types

`src/types/pocketbase.ts` is generated from the PocketBase schema — don't edit it.
After changing a collection:

```sh
bun run typegen
```

It reads `../backend/pb_data/data.db` directly, so the backend has to have run at
least once. `pb` is cast to the generated `TypedPocketBase`, which is what makes
`pb.collection('users')` return typed records.

## Translations

`messages/de.json` and `messages/en.json`. German is the default and the fallback.

Locale is stored in a cookie rather than the URL, so there is no routing layer and
no proxy hop — `src/i18n/locale.ts` reads and writes it, and the switcher calls
`router.refresh()` because messages resolve on the server.

Numbers go through `useFormatter` rather than string templates, which is what
renders a grade as `1,0` for a German reader and `1.0` for an English one. Keep
grades as numbers for that reason.
