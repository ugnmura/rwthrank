package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// Separates Bachelor from Master.
//
// Without this the two share a cohort, and they are not comparable: Master
// intakes are already filtered by their Bachelor result, so their grades sit
// noticeably better and a Bachelor student would be ranked against a population
// they are not part of.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.Add(&core.SelectField{
			Name:      "degree",
			MaxSelect: 1,
			Values:    []string{"Bachelor", "Master"},
			// Same reason as program and grade: the account exists before the
			// user has told us anything.
			Required: false,
		})

		return app.Save(users)
	}, func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		users.Fields.RemoveByName("degree")

		return app.Save(users)
	})
}
