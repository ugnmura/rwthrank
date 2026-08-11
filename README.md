# rwthrank

See where your grades land. Passwordless from end to end — users register and
sign in with a code emailed to them, and no password exists anywhere in the flow.

```
backend/    PocketBase (Go) — auth, database, admin dashboard
frontend/   Next.js 16 + React Query + daisyUI, German by default
```

## Start everything

```sh
docker compose up --build
```

| | | |
|---|---|---|
| Frontend | http://localhost:3000 | the sign-in page |
| PocketBase | http://localhost:8090/_/ | admin dashboard |
| Mailpit | http://localhost:8025 | every email the app sends |

Sign-in codes are real emails. Nothing leaves the machine — Mailpit catches all
of it, so open http://localhost:8025 to read the code you were just sent.

Create the dashboard superuser once:

```sh
docker compose exec backend /app/rwthrank superuser upsert you@example.com yourpassword
```

If a port is already taken, copy `.env.example` to `.env` and change it.

## Working on one piece at a time

**Backend**, with codes printed to the console instead of mailed:

```sh
cd backend && go run . serve --dev
```

**Frontend**, against whatever PocketBase is running:

```sh
cd frontend && bun install && bun run dev
```

Regenerate the TypeScript types after a collection changes — it reads the schema
straight out of the database file:

```sh
cd frontend && bun run typegen
```

## How the pieces fit

`request-otp` mails a code and `auth-with-otp` trades it for a session. There is
no third endpoint for registration: an unknown email gets an account on the first
code it verifies, which is what makes one form serve both cases. See
[backend/README.md](backend/README.md) for why that needed a hook and what it
means for account creation.

The frontend holds the session in `pb.authStore` and mirrors it into React Query,
so the two network calls are mutations and the current user is a cached query.

Locale lives in a cookie rather than the URL — one signed-in surface doesn't need
`/de` and `/en` indexed separately. German is the default; grades render as
`1,0` there and `1.0` in English, from the same numbers.

## Deploying

The compose stack is a development environment. For anything real:

- **Point `SMTP_*` at a mail server that delivers.** PocketBase deletes an OTP
  when its email fails to send, so codes silently stop working otherwise.
- **Build the frontend for production** — the compose service runs `next dev`.
  The Dockerfile's `runner` stage is the one you want, and it needs
  `NEXT_PUBLIC_POCKETBASE_URL` at build time because the value is inlined into
  the client bundle.
- **Back up `pb_data`.** It is the whole database.
