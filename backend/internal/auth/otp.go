// Package auth wires up passwordless authentication.
//
// The whole flow is two requests against the stock PocketBase API:
//
//	POST /api/collections/users/request-otp   {"email": "..."}       -> {"otpId": "..."}
//	POST /api/collections/users/auth-with-otp {"otpId":"", "password":"<code>"} -> {"token": "...", "record": {...}}
//
// Login and registration are the same two requests; see RegisterOTP.
package auth

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/mailer"
)

// usersCollection is the auth collection served by the OTP flow.
const usersCollection = "users"

// RegisterOTP installs the hooks that turn request-otp into a combined
// sign-up/sign-in endpoint.
func RegisterOTP(app *pocketbase.PocketBase) {
	sendMagicLink(app)
	printOTPInDev(app)
	createAccountOnFirstOTP(app)
}

// sendMagicLink replaces the code email with a single confirmation link.
//
// The code itself still exists and still expires — the link just carries it, so
// nobody has to copy eight digits between two windows. Nothing about the auth
// changes: the landing page redeems the pair against auth-with-otp exactly as a
// typed code would.
//
// FRONTEND_URL has to be set, because the link points at the site rather than at
// this API. Without it the stock code email goes out unchanged, which keeps a
// misconfigured deployment usable instead of sending links to nowhere.
func sendMagicLink(app *pocketbase.PocketBase) {
	app.OnMailerRecordOTPSend(usersCollection).BindFunc(func(e *core.MailerRecordEvent) error {
		base := strings.TrimSuffix(os.Getenv("FRONTEND_URL"), "/")
		if base == "" {
			return e.Next()
		}

		otpID, _ := e.Meta["otpId"].(string)
		code, _ := e.Meta["password"].(string)
		if otpID == "" || code == "" {
			return e.Next()
		}

		link := fmt.Sprintf("%s/verify?id=%s&code=%s",
			base, url.QueryEscape(otpID), url.QueryEscape(code))

		// German only for now: the request carries no locale, and the audience
		// reads German. Worth threading a locale through when that stops holding.
		e.Message.Subject = "Deine Platzierung bei rwthrank"
		e.Message.HTML = fmt.Sprintf(`<p>Hallo,</p>
<p>klick auf den Link, um deine E-Mail zu bestätigen und deine Platzierung zu sehen.</p>
<p><a href="%s">Platzierung ansehen</a></p>
<p>Der Link ist fünf Minuten gültig und funktioniert einmal.</p>
<p>Wenn du das nicht warst, kannst du diese E-Mail ignorieren.</p>`, link)

		return e.Next()
	})
}

// createAccountOnFirstOTP lets an unknown email request a code and get an account.
//
// PocketBase only issues an OTP for a record that already exists: for an unknown
// email it leaves e.Record nil and the default handler replies with a throwaway
// otpId, so the endpoint can't be used to probe which addresses have accounts.
// That protection also means nothing can ever create the first record. Filling in
// e.Record here closes the gap — the code sent to a new address both creates the
// account and logs it in, and because a real otpId comes back either way the
// endpoint still answers identically for known and unknown emails.
func createAccountOnFirstOTP(app *pocketbase.PocketBase) {
	app.OnRecordRequestOTPRequest(usersCollection).BindFunc(func(e *core.RecordCreateOTPRequestEvent) error {
		if e.Record != nil {
			return e.Next() // returning user
		}

		email, err := requestedEmail(e)
		if err != nil {
			return err
		}

		record := core.NewRecord(e.Collection)
		record.SetEmail(email)
		// Auth records still carry a password column, so it needs a value. Nothing
		// can use it: password auth is disabled for this collection, and
		// auth-with-otp rotates it again on the first successful verification.
		record.SetRandomPassword()

		if err := e.App.Save(record); err != nil {
			// Most likely two requests raced for the same new address and the
			// unique index rejected the second one. Prefer the winner's record
			// over failing a request the user can't do anything about.
			existing, findErr := e.App.FindAuthRecordByEmail(e.Collection, email)
			if findErr != nil {
				return fmt.Errorf("failed to create %s record for %s: %w", usersCollection, email, err)
			}
			record = existing
		} else {
			e.App.Logger().Info("Registered account from OTP request", "email", email, "recordId", record.Id)
		}

		e.Record = record

		return e.Next()
	})
}

// printOTPInDev writes the code to the console instead of mailing it when the
// app runs with --dev, so the flow works end to end before SMTP exists.
//
// This is load-bearing rather than a convenience: PocketBase deletes the OTP if
// delivery returns an error, so on a machine with no mail transport every issued
// code is already dead by the time it is typed in.
//
// It swaps the transport rather than skipping the send, so the rest of the
// default handler still runs and still records which address the code went to.
// That field is what auth-with-otp checks before marking the email verified, so
// leaving it unset would quietly give dev a different outcome than production.
func printOTPInDev(app *pocketbase.PocketBase) {
	app.OnMailerRecordOTPSend(usersCollection).BindFunc(func(e *core.MailerRecordEvent) error {
		if !e.App.IsDev() {
			return e.Next()
		}

		e.App.Logger().Info(
			"DEV OTP - email not sent",
			"email", e.Record.Email(),
			"otpId", e.Meta["otpId"],
			"otp", e.Meta["password"],
		)

		e.Mailer = discardMailer{}

		return e.Next()
	})
}

// discardMailer accepts every message and delivers none.
type discardMailer struct{}

func (discardMailer) Send(*mailer.Message) error { return nil }

// requestedEmail reads the email off the request body. The handler has already
// validated that it is present and well formed before any hook runs.
func requestedEmail(e *core.RecordCreateOTPRequestEvent) (string, error) {
	info, err := e.RequestInfo()
	if err != nil {
		return "", err
	}

	email, _ := info.Body["email"].(string)
	email = strings.TrimSpace(email)
	if email == "" {
		return "", e.BadRequestError("Missing email.", nil)
	}

	return email, nil
}
