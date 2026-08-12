package transcript

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// gradePath records a grade nobody uploaded a document for.
//
//	POST /api/grade  {"grade": 2.4}  -> {"id":"..."}
//
// Registration asks for an address and a grade, and that grade is a transcript
// like any other: one with a grade and nothing else. Everything the ranking
// reads then comes from the same place, instead of the account holding a second
// answer that a later upload could contradict.
const gradePath = "/api/grade"

type gradeBody struct {
	Grade float64 `json:"grade"`
}

func handleGrade(e *core.RequestEvent) error {
	body := gradeBody{}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Expected a grade.", err)
	}

	// The German scale, same bound the field enforces. Checked here so the
	// answer is a sentence rather than a validation dump.
	if body.Grade < 1 || body.Grade > 5 {
		return e.BadRequestError("A grade is between 1.0 and 5.0.", nil)
	}

	transcripts, err := e.App.FindCollectionByNameOrId(transcriptsCollection)
	if err != nil {
		return e.InternalServerError("", err)
	}

	// Replace the previous typed grade rather than stacking them up: someone
	// correcting a typo means to change their answer, not to claim two.
	existing, err := e.App.FindRecordsByFilter(
		transcriptsCollection,
		"user = {:user} && pdf = ''",
		"-uploaded",
		1,
		0,
		dbx.Params{"user": e.Auth.Id},
	)
	if err != nil {
		return e.InternalServerError("", err)
	}

	record := core.NewRecord(transcripts)
	if len(existing) > 0 {
		record = existing[0]
	}
	record.Set("user", e.Auth.Id)
	record.Set("grade", body.Grade)

	if err := e.App.Save(record); err != nil {
		return e.BadRequestError("Could not save that grade.", err)
	}

	return e.JSON(http.StatusOK, map[string]string{"id": record.Id})
}

func registerGradeRoute(se *core.ServeEvent) {
	se.Router.POST(gradePath, handleGrade).Bind(apis.RequireAuth())
}
