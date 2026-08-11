# rwthrank backend

PocketBase with passwordless auth. Users register and sign in with an emailed
one-time code — there is no password anywhere in the flow.

Run it with the rest of the stack via `docker compose up` from the repository
root; the notes below are for working on it alone.

## Run it

```sh
go build -o rwthrank .
./rwthrank serve --dev
```

First run creates `pb_data/`, applies the migrations, and prints a link to set up
your superuser account for the dashboard at http://127.0.0.1:8090/_/.

## The auth flow

Registration and login are the same two requests. If the email has no account
yet, the first code creates one.

```sh
# 1. ask for a code
curl -X POST http://127.0.0.1:8090/api/collections/users/request-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
# -> {"otpId":"mxb1gdd9ts7jh3k"}

# 2. exchange the code for a session
curl -X POST http://127.0.0.1:8090/api/collections/users/auth-with-otp \
  -H 'Content-Type: application/json' \
  -d '{"otpId":"mxb1gdd9ts7jh3k","password":"04699589"}'
# -> {"token":"...","record":{...}}
```

From the JS SDK:

```js
const { otpId } = await pb.collection('users').requestOTP(email)
const authData = await pb.collection('users').authWithOTP(otpId, code)
```

The returned token is an ordinary PocketBase auth token, so API rules,
`@request.auth.id`, and `pb.authStore` all work as usual.

### In development

`--dev` prints the code to the console and skips the email, so the flow works
before any SMTP setup:

```
INFO DEV OTP - email not sent
└─ {"email":"you@example.com","otpId":"mxb1gdd9ts7jh3k","otp":"04699589"}
```

Without `--dev` this hook does nothing and real mail is sent.

## How it is wired

| | |
|---|---|
| `migrations/1754956800_otp_only_auth.go` | Turns OTP on and password auth off for `users`, and closes the record-create API |
| `migrations/1754960000_user_program_grade.go` | Adds `program` and `grade` to `users` |
| `internal/auth/otp.go` | Makes `request-otp` register unknown emails; dev code printing |
| `internal/config/settings.go` | Applies SMTP and app naming from the environment on boot |
| `internal/rank/rank.go` | Serves `GET /api/rank` |
| `internal/transcript/` | Parses a Notenspiegel PDF; serves `POST /api/transcript` |

## Transcripts

`POST /api/transcript` takes a Notenspiegel PDF as multipart `file` and returns
what it read:

```sh
curl -X POST http://127.0.0.1:8090/api/transcript \
  -H 'Authorization: <token>' -F file=@transcript.pdf
# -> {"program":"Maschinenbau","grade":2.3,"credits":96,"maxCredits":180,"moduleCount":17}
```

**The upload is parsed in memory and discarded.** Holding other students' full
transcripts, with their name, date of birth and Matrikelnummer in them, is a
liability the product does not need — the numbers are all it wants.

Extraction is geometric rather than delimiter-based: text fragments are grouped
into lines by their Y coordinate and split into columns on X gaps wider than
`1.2 × font size`. That matters because the library decodes the column separator
glyph as U+FFFD, so anything keyed on the separator character would be building
on a bug. Letters, umlauts included, come through correctly.

The parsed modules' credits sum to exactly the printed Gesamtcredits, which is the
invariant the tests assert: a roll-up row leaking into the module list
double-counts a whole Modulbereich, and a dropped module loses its own.

## The ranking

`program` and `grade` are ordinary fields on the `users` record, so the frontend
submits them with a normal `PATCH /api/collections/users/records/:id`. Grades use
the German scale and are constrained to 1.0-5.0, which also makes the zero value
mean "not submitted yet".

```sh
curl http://127.0.0.1:8090/api/rank -H 'Authorization: <token>'
# -> {"program":"Maschinenbau","grade":2.3,"rank":58,"total":240,"percentile":24.2}
```

Everyone is ranked only against their own programme — a 2.0 in Maschinenbau and a
2.0 in Medizin are not the same achievement. Equal grades share a rank, and
`percentile` is the "top N %" figure, so lower is better.

A user who hasn't submitted anything yet gets `200` with null fields rather than
an error, which is how the frontend decides between the form and the dashboard.

## Environment

Settings normally live in the database, which makes a container's behaviour
depend on whatever was last saved in the dashboard. These override them on every
boot instead. Nothing is applied unless `SMTP_HOST` is set.

| | |
|---|---|
| `SMTP_HOST` | Mail server hostname. Enables the rest when set. |
| `SMTP_PORT` | Defaults to 587. |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Optional. |
| `SMTP_TLS` | `true` requires TLS; otherwise StartTLS is offered. |
| `APP_NAME` | Shown in email subjects and the dashboard. |
| `APP_URL` | Base URL used in emailed links. |
| `SENDER_NAME`, `SENDER_ADDRESS` | The `From:` header. |

Two things are worth knowing about the design.

**Registration needed a hook.** Stock PocketBase only issues a code to a record
that already exists — for an unknown email it returns a throwaway `otpId` so the
endpoint can't be used to check which addresses have accounts. That also means
nothing can create the first record. `OnRecordRequestOTPRequest` fires with a nil
record in exactly that case, so the hook fills it in. Known and unknown emails
still get identical responses, so the enumeration protection survives.

**Accounts can only come from a verified code.** `createRule` is `null`, so
`POST /api/collections/users/records` is closed to everyone but superusers. The
hook saves at app level and bypasses the rule, which leaves the OTP flow as the
single path to an account.

Auth records still have a password column and it still has a value — a random one
set at creation and rotated again by PocketBase on first verification. It is not
a credential: `passwordAuth.enabled` is false, so `auth-with-password` is refused
for the collection outright.

## Before deploying

- **Configure SMTP** in the dashboard under Settings → Mail. Nothing else about
  this setup matters if codes can't be delivered: PocketBase deletes an OTP when
  its email fails to send.
- **Set the code lifetime and length** in `migrations/1754956800_otp_only_auth.go`
  if 5 minutes and 8 digits don't suit you.
- **Keep the rate limiter on.** Short numeric codes are guessable in bulk;
  PocketBase caps verification attempts per OTP, and the collection-level limits
  are what stop someone from spraying `request-otp`.
- **Account recovery is inbox access.** With no password there is no fallback
  path — whoever controls the mailbox controls the account.

## Tests

The flow is exercised end to end by hand in `--dev` mode. Worth adding as real Go
tests against `tests.NewTestApp` before this grows.
