package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Gives users the two things a ranking needs: which degree programme they are in
// and the grade to rank inside it.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.Add(&core.SelectField{
			Name:      "program",
			MaxSelect: 1,
			Values: []string{
				"Informatik",
				"Maschinenbau",
				"Elektrotechnik",
				"Bauingenieurwesen",
				"Wirtschaftsingenieurwesen",
				"Mathematik",
				"Physik",
				"Chemie",
				"Biologie",
				"Medizin",
				"Psychologie",
				"Architektur",
				"Sonstiges",
			},
			// Not required: the OTP flow creates the account before the user has
			// told us anything about themselves, so both fields start empty and
			// the frontend asks for them afterwards.
			Required: false,
		})

		users.Fields.Add(&core.NumberField{
			Name: "grade",
			// German scale, 1.0 best through 5.0 fail. The bounds also make the
			// zero value unambiguous: 0 is out of range, so it can only mean
			// "not submitted yet".
			Min:      types.Pointer(1.0),
			Max:      types.Pointer(5.0),
			Required: false,
		})

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.RemoveByName("program")
		users.Fields.RemoveByName("grade")

		return app.Save(users)
	})
}
