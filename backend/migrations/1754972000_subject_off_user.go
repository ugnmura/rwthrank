package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Empties the user record.
//
// A Notenspiegel names the programme, the degree and the grade, so keeping them
// on the account as well meant two copies of the same fact that could disagree:
// someone could pick Maschinenbau in a dropdown and upload an Informatik
// transcript. The document is the source.
//
// A typed grade is therefore also a transcript, just one without a file. That
// keeps a single answer to "what did this person achieve" instead of two that
// have to be reconciled, and leaves the account holding an email address and
// nothing else.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.RemoveByName("program")
		users.Fields.RemoveByName("degree")
		users.Fields.RemoveByName("grade")

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.Add(&core.SelectField{
			Name:      "program",
			MaxSelect: 1,
			Values: []string{
				"Informatik", "Maschinenbau", "Elektrotechnik", "Bauingenieurwesen",
				"Wirtschaftsingenieurwesen", "Mathematik", "Physik", "Chemie",
				"Biologie", "Medizin", "Psychologie", "Architektur", "Sonstiges",
			},
		})
		users.Fields.Add(&core.SelectField{
			Name:      "degree",
			MaxSelect: 1,
			Values:    []string{"Bachelor", "Master"},
		})
		users.Fields.Add(&core.NumberField{
			Name: "grade",
			Min:  types.Pointer(1.0),
			Max:  types.Pointer(5.0),
		})

		return app.Save(users)
	})
}
