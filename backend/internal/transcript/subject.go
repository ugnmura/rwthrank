package transcript

import (
	"net/http"
	"slices"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// subjectPath names the programme and degree on a transcript.
//
//	POST /api/transcript/{id}/subject  {"program":"Informatik","degree":"Bachelor"}
//
// An uploaded Notenspiegel says both, so this is for the placeholder a typed
// grade creates: it has a number and nothing else until someone says what it
// was for. Only these two fields are writable here — the grade, the credits and
// the modules come from a document and must not be editable by hand.
const subjectPath = "/api/transcript/{id}/subject"

// Mirrors the values the collection accepts. Kept here so a bad request gets a
// sentence back rather than a validation dump.
var (
	programs = []string{
		"Informatik", "Maschinenbau", "Elektrotechnik", "Bauingenieurwesen",
		"Wirtschaftsingenieurwesen", "Mathematik", "Physik", "Chemie",
		"Biologie", "Medizin", "Psychologie", "Architektur", "Sonstiges",
	}
	degrees = []string{"Bachelor", "Master"}
)

type subjectBody struct {
	Program string `json:"program"`
	Degree  string `json:"degree"`
}

func handleSubject(e *core.RequestEvent) error {
	body := subjectBody{}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Expected a program and a degree.", err)
	}

	if !slices.Contains(programs, body.Program) {
		return e.BadRequestError("That is not one of the listed subjects.", nil)
	}
	if !slices.Contains(degrees, body.Degree) {
		return e.BadRequestError("A degree is either Bachelor or Master.", nil)
	}

	record, err := e.App.FindRecordById(transcriptsCollection, e.Request.PathValue("id"))
	if err != nil {
		return e.NotFoundError("No such transcript.", err)
	}

	// Ownership is checked here rather than by a collection rule, because the
	// route bypasses them: without this anyone could rename anyone's transcript.
	if record.GetString("user") != e.Auth.Id {
		return e.NotFoundError("No such transcript.", nil)
	}

	record.Set("program", body.Program)
	record.Set("degree", body.Degree)

	if err := e.App.Save(record); err != nil {
		return e.BadRequestError("Could not save that subject.", err)
	}

	return e.JSON(http.StatusOK, map[string]string{
		"program": body.Program,
		"degree":  body.Degree,
	})
}

func registerSubjectRoute(se *core.ServeEvent) {
	se.Router.POST(subjectPath, handleSubject).Bind(apis.RequireAuth())
}
