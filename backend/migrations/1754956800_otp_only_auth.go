package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Switches the users collection to OTP-only auth: email codes on, passwords off.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.OTP.Enabled = true
		users.OTP.Duration = 300 // seconds
		users.OTP.Length = 8

		// With this off PocketBase rejects auth-with-password for the collection
		// outright, so the stored password hash stops being a credential.
		users.PasswordAuth.Enabled = false

		// Accounts come from the OTP hook, which saves at app level and bypasses
		// this rule. Locking the API route shut means a verified code is the only
		// way an account can come into existence.
		users.CreateRule = nil

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.OTP.Enabled = false
		users.PasswordAuth.Enabled = true

		publicCreate := ""
		users.CreateRule = &publicCreate

		return app.Save(users)
	})
}
