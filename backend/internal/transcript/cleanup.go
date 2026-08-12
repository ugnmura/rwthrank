package transcript

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// RegisterCleanup removes courses that nothing points at any more.
//
// Deleting a transcript cascades to its results, and a course whose last result
// went with it is a name nobody has a grade in. Leaving those behind would grow
// a list of courses that look rankable and answer with nothing.
//
// This runs after the delete rather than inside it: the cascade has to have
// finished before the count means anything.
func RegisterCleanup(app *pocketbase.PocketBase) {
	app.OnRecordAfterDeleteSuccess(transcriptsCollection).BindFunc(func(e *core.RecordEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		if err := deleteOrphanCourses(e.App); err != nil {
			// The transcript is already gone and the user's request succeeded.
			// A leftover course row is untidy, not broken, so it is logged
			// rather than turned into an error they cannot act on.
			e.App.Logger().Error("Failed to clean up orphan courses", "error", err)
		}

		return nil
	})
}

func deleteOrphanCourses(app core.App) error {
	orphans, err := app.FindRecordsByFilter(
		coursesCollection,
		// PocketBase exposes the back-relation as results_via_course; a course
		// with no results at all is one nobody has a grade in.
		"results_via_course.id = null",
		"",
		0,
		0,
		dbx.Params{},
	)
	if err != nil {
		return err
	}

	for _, course := range orphans {
		if err := app.Delete(course); err != nil {
			return err
		}
	}

	return nil
}
