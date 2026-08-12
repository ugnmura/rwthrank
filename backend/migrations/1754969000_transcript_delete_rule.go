package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Lets a user delete their own transcript.
//
// The privacy policy says an uploaded Notenspiegel can be removed at any time,
// and a promise nothing in the API can honour is worse than no promise. Writes
// stay closed: only delete is opened, because deleting is the one change to a
// transcript that comes from a person rather than from parsing a document.
//
// The results hanging off it go with it, via the cascade already on the
// relation, so no per-module cleanup is needed here.
func init() {
	m.Register(func(app core.App) error {
		transcripts, err := app.FindCollectionByNameOrId("transcripts")
		if err != nil {
			return err
		}

		ownRecord := "user = @request.auth.id"
		transcripts.DeleteRule = &ownRecord

		return app.Save(transcripts)
	}, func(app core.App) error {
		transcripts, err := app.FindCollectionByNameOrId("transcripts")
		if err != nil {
			return err
		}

		transcripts.DeleteRule = nil

		return app.Save(transcripts)
	})
}
