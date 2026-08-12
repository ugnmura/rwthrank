# Working on rwthrank

Everything operational: how to run it, how to change it, and the things that
have already gone wrong once.

## Run the whole stack

```sh
docker compose up --build
```

| | | |
|---|---|---|
| Frontend | http://localhost:3000 | the site |
| PocketBase | http://localhost:8090/_/ | admin dashboard |
| Mailpit | http://localhost:8025 | every email the app sends |

Sign-in codes are real emails and Mailpit catches all of them, so open
http://localhost:8025 to read the code you were just sent. Nothing leaves the
machine.

Create the dashboard superuser once:

```sh
docker compose exec backend /app/rwthrank superuser upsert you@example.com yourpassword
```

If a port is taken, copy `.env.example` to `.env` and change it.

## One piece at a time

**Backend**, with codes printed to the console instead of mailed:

```sh
cd backend && go run . serve --dev
```

**Frontend**, against whatever PocketBase is running:

```sh
cd frontend && bun install && bun run dev
```

**Types**, after any collection changes. It reads `backend/pb_data/data.db`
directly, so the backend has to have run at least once:

```sh
cd frontend && bun run typegen
```

**The API suite**, against a *clean* database on port 8082 — it registers
accounts, uploads transcripts and deletes things:

```sh
cd backend && ./edge-test.sh
```

## Conventions

- **Go only.** No Python sidecars, no separate parsing service. The server has
  little memory and one binary is the whole point. PDF parsing belongs in Go.
- **Never commit real transcript data.** Not a grade, not a module list, not a
  screenshot of a dashboard with someone's numbers in it. `*.pdf` and `*.png`
  are ignored for that reason. Tests assert invariants (credits sum to the
  printed total) rather than expected marks. This has gone wrong before and a
  force-push did not fix it: GitHub kept serving the old commit, and the repo
  had to be deleted and recreated.
- **Commits carry no Claude attribution.** No `Co-Authored-By`, no "Generated
  with" trailer.
- **German copy is plain du-form.** No marketing phrasing, no em dashes. German
  is the default locale and the fallback; English is a translation of it.
- **Grades stay numbers** all the way to `useFormatter`, which is what renders
  `1,0` for a German reader and `1.0` for an English one.
- **Locale lives in localStorage**, read through `useSyncExternalStore`. The
  frontend is a static export, so there is no server to read a cookie on.
- **Keep per-module rows.** Ranking spans a class, a programme, a semester and
  combinations of them, and none of that can be recovered from a single average.

## Deploying

```
push to main (backend/**)   ->  CI builds  ->  GHCR  ->  Watchtower on the box  ->  api.rwthrank.mindevice.net
push to main (frontend/**)  ->  CI builds  ->  Pages artifact                   ->  rwthrank.mindevice.net
```

Nothing in CI SSHes anywhere. Details, DNS, and the mail setup are in
[deploy/README.md](deploy/README.md).

## Things that have bitten

- **SMTP is not optional.** PocketBase deletes an OTP when its email fails to
  send, so a deployment without working mail hands out codes that are already
  gone by the time anyone types them. Nothing looks broken except one error line
  per attempt.
- **`docker compose pull` can silently no-op.** It reports "Pulled" and keeps
  the old image, and then `migrate up` truthfully says there is nothing new. Use
  `docker pull` and check the image digest.
- **The magic link goes in the URL fragment.** Quoted-printable soft-wraps a
  line at 76 characters by breaking on `=`, which corrupted the query-string
  version in real inboxes while looking perfect in Mailpit.
- **`pb_data` is the entire database.** Bind-mounted on the box, in no image and
  in no repository. Back it up.
- **Error sentinels are stripped from the binary.** `-ldflags="-s -w"` removes
  them, so probing a deployed build for `ErrWouldReplace` by name proves
  nothing. Check behaviour or the error string.
- **Empty SQL aggregates are NULL, not zero.** A filter matching nobody makes
  `AVG`/`SUM` return NULL, which will not scan into a Go number. `COALESCE`.
- **The shell keeps its working directory between commands.** Several files have
  been created in the wrong subfolder that way.
