package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Keeps the English name of every class alongside the German one.
//
// RWTH prints each Notenspiegel twice, the second time translated, so both
// names are already in the document. Storing them means a class can be shown in
// whichever language the reader chose rather than always in German.
func init() {
	m.Register(func(app core.App) error {
		courses, err := app.FindCollectionByNameOrId("courses")
		if err != nil {
			return err
		}

		courses.Fields.Add(&core.TextField{Name: "nameEn", Max: 300})

		return app.Save(courses)
	}, func(app core.App) error {
		courses, err := app.FindCollectionByNameOrId("courses")
		if err != nil {
			return err
		}

		courses.Fields.RemoveByName("nameEn")

		return app.Save(courses)
	})
}
