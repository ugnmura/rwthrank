package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// The account record is not editable through the API.
//
// It held a programme and a grade once; both moved onto transcripts, and what
// is left is an email address and the flags PocketBase keeps for itself. The
// update rule was still open to the owner, which is a write nothing in the app
// performs and therefore only a way in: emailVisibility, and anything a later
// field adds, could be set by hand with a bearer token.
//
// Creating stays closed — a verified code is the only way an account appears —
// and deleting stays open to the owner, because that is a real button on the
// settings page and it has to work without an administrator.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.UpdateRule = nil

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		own := "id = @request.auth.id"
		users.UpdateRule = &own

		return app.Save(users)
	})
}
