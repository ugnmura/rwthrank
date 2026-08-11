# rwthrank

PocketBase backend with passwordless auth. Users register and sign in with an
emailed one-time code — there is no password anywhere in the flow.

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
| `internal/auth/otp.go` | Makes `request-otp` register unknown emails; dev code printing |

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
