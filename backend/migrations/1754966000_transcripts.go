package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// The transcript schema: courses, transcripts, and the results that join them.
//
// Three collections rather than one, because each answers a different question.
//
//   - courses    one row per module that has ever been seen, so "how did people
//     do in Datenstrukturen" is a lookup and not a string match
//     across every row in the database
//   - transcripts one row per uploaded document, because a person has more than
//     one: a Bachelor and a Master are different documents, and
//     re-uploading a semester later is another
//   - results    one row per module on one transcript, pointing at both
//
// The uploaded PDF is kept on the transcript. It is protected, so reading it
// back needs a file token rather than just the URL.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// Owner-only reads throughout. Every write happens server-side while
		// parsing a document, never from a form, so there are no create rules.
		ownRecord := "user = @request.auth.id"

		courses := core.NewBaseCollection("courses")
		courses.Fields.Add(
			&core.TextField{Name: "name", Max: 300, Required: true},
		)
		// Course names are shared across everyone, so they are readable by any
		// signed-in user rather than by an owner.
		signedIn := "@request.auth.id != ''"
		courses.ListRule = &signedIn
		courses.ViewRule = &signedIn
		courses.AddIndex("idx_courses_name", true, "name", "")

		if err := app.Save(courses); err != nil {
			return err
		}

		transcripts := core.NewBaseCollection("transcripts")
		transcripts.Fields.Add(
			&core.RelationField{
				Name:          "user",
				CollectionId:  users.Id,
				CascadeDelete: true, // deleting an account takes its transcripts with it
				MaxSelect:     1,
				Required:      true,
			},
			&core.FileField{
				Name:      "pdf",
				MaxSelect: 1,
				MaxSize:   10 << 20,
				MimeTypes: []string{"application/pdf"},
				// Not served from a guessable URL: someone else's Notenspiegel
				// carries their name, date of birth and Matrikelnummer.
				Protected: true,
			},
			&core.TextField{Name: "program", Max: 200},
			&core.SelectField{Name: "degree", MaxSelect: 1, Values: []string{"Bachelor", "Master"}},
			&core.NumberField{Name: "grade", Min: types.Pointer(1.0), Max: types.Pointer(5.0)},
			&core.NumberField{Name: "credits", Min: types.Pointer(0.0)},
			&core.NumberField{Name: "maxCredits", Min: types.Pointer(0.0)},
			&core.AutodateField{Name: "uploaded", OnCreate: true},
		)
		transcripts.ListRule = &ownRecord
		transcripts.ViewRule = &ownRecord
		transcripts.AddIndex("idx_transcripts_user", false, "user", "")

		if err := app.Save(transcripts); err != nil {
			return err
		}

		results := core.NewBaseCollection("results")
		results.Fields.Add(
			&core.RelationField{
				Name:          "transcript",
				CollectionId:  transcripts.Id,
				CascadeDelete: true,
				MaxSelect:     1,
				Required:      true,
			},
			&core.RelationField{
				Name:          "course",
				CollectionId:  courses.Id,
				CascadeDelete: false, // a course outlives any one person's result
				MaxSelect:     1,
				Required:      true,
			},
			// Denormalised from the transcript so a per-course ranking can filter
			// by owner without joining on every row.
			&core.RelationField{
				Name:          "user",
				CollectionId:  users.Id,
				CascadeDelete: true,
				MaxSelect:     1,
				Required:      true,
			},
			// Zero means passed without a grade, which the German scale allows.
			&core.NumberField{Name: "grade", Min: types.Pointer(0.0), Max: types.Pointer(5.0)},
			&core.BoolField{Name: "passed"},
			&core.NumberField{Name: "credits", Min: types.Pointer(0.0)},
			&core.TextField{Name: "semester", Max: 10},
		)
		results.ListRule = &ownRecord
		results.ViewRule = &ownRecord
		results.AddIndex("idx_results_course", false, "course", "")
		results.AddIndex("idx_results_user", false, "user", "")

		return app.Save(results)
	}, func(app core.App) error {
		// Dependency order: results point at transcripts and courses.
		for _, name := range []string{"results", "transcripts", "courses"} {
			collection, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue // already gone
			}
			if err := app.Delete(collection); err != nil {
				return err
			}
		}

		return nil
	})
}
