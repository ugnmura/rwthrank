package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Records the date printed on the document.
//
// It is what decides whether an upload is newer than the one already stored.
// The upload timestamp cannot: a PDF exported last year can be uploaded today,
// and re-uploading an old export would otherwise roll a student's results back.
func init() {
	m.Register(func(app core.App) error {
		transcripts, err := app.FindCollectionByNameOrId("transcripts")
		if err != nil {
			return err
		}

		// ISO, so string order is date order and SQLite can compare it.
		transcripts.Fields.Add(&core.TextField{Name: "issued", Max: 10})

		return app.Save(transcripts)
	}, func(app core.App) error {
		transcripts, err := app.FindCollectionByNameOrId("transcripts")
		if err != nil {
			return err
		}

		transcripts.Fields.RemoveByName("issued")

		return app.Save(transcripts)
	})
}
