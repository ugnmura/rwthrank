package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Stops zero standing in for "not stated".
//
// A grade of 0 does not exist on the German scale, so writing one to mean "no
// grade" made an impossible value the marker for a missing one. Worse for
// credits: 0 is a real answer — a failed attempt earns none — so it could not
// be told apart from a document that never said.
//
// Both are left NULL when absent instead. The lower bound on a grade moves to
// 1.0 so a zero cannot be stored at all.
func init() {
	m.Register(func(app core.App) error {
		results, err := app.FindCollectionByNameOrId("results")
		if err != nil {
			return err
		}

		results.Fields.RemoveByName("grade")
		results.Fields.Add(&core.NumberField{
			Name: "grade",
			Min:  types.Pointer(1.0),
			Max:  types.Pointer(5.0),
		})

		return app.Save(results)
	}, func(app core.App) error {
		results, err := app.FindCollectionByNameOrId("results")
		if err != nil {
			return err
		}

		results.Fields.RemoveByName("grade")
		results.Fields.Add(&core.NumberField{
			Name: "grade",
			Min:  types.Pointer(0.0),
			Max:  types.Pointer(5.0),
		})

		return app.Save(results)
	})
}
