package rank

import (
	"net/http"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// optionsPath lists what a comparison can be narrowed to.
//
//	GET /api/compare/options
//	-> {"semesters":["23W","24S","25S"]}
//
// Built from everyone's results rather than the caller's own, because the point
// of asking is often a semester they have not sat yet: what the year above
// scored in it is a real question, and a list of only your own semesters cannot
// answer it.
//
// A semester label is not anyone's data — it is a date the university runs on —
// so the list gives nothing away about who is in it.
const optionsPath = "/api/compare/options"

type optionsResponse struct {
	Semesters []string `json:"semesters"`
}

func handleOptions(e *core.RequestEvent) error {
	out := optionsResponse{Semesters: []string{}}

	err := e.App.DB().
		NewQuery(`SELECT DISTINCT semester FROM results
		          WHERE semester != '' AND grade IS NOT NULL AND credits > 0
		          ORDER BY semester`).
		Column(&out.Semesters)
	if err != nil {
		return e.InternalServerError("Failed to list the semesters.", err)
	}

	return e.JSON(http.StatusOK, out)
}

func registerOptionsRoute(se *core.ServeEvent) {
	se.Router.GET(optionsPath, handleOptions).Bind(apis.RequireAuth())
}
