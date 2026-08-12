// Package rank answers where the signed-in user stands among their peers.
//
//	GET /api/rank -> {"program":"Maschinenbau","grade":2.3,"rank":58,"total":240,"percentile":24.2}
//
// See RegisterRoutes.
package rank

import (
	"math"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// usersCollection holds the grades being ranked.
const usersCollection = "users"

// response is the wire shape. Everything but total is nullable because a user
// exists from their first login, long before they submit a grade.
type response struct {
	// Scope says what the rank is measured against: "program" once we know the
	// programme and degree, "overall" until then.
	Scope      string   `json:"scope"`
	Program    *string  `json:"program"`
	Degree     *string  `json:"degree"`
	Grade      *float64 `json:"grade"`
	Rank       *int64   `json:"rank"`
	Total      int64    `json:"total"`
	Percentile *float64 `json:"percentile"`
}

// RegisterRoutes installs GET /api/rank.
func RegisterRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/rank", handleRank).Bind(apis.RequireAuth())

		return se.Next()
	})
}

// handleRank ranks the caller within their own programme and degree level.
//
// Grades only mean something next to comparable ones: a 2.0 in Maschinenbau and
// a 2.0 in Medizin are not the same achievement, and neither are a Bachelor 2.0
// and a Master 2.0. The cohort is always the authenticated user's own.
//
// An incomplete profile is a normal state, not an error — the frontend reads the
// null fields as "show the form instead of the dashboard".
func handleRank(e *core.RequestEvent) error {
	// Only the users collection carries these fields; a superuser token falls
	// through the empty checks below and gets the not-set answer.
	program := e.Auth.GetString("program")
	degree := e.Auth.GetString("degree")
	grade := e.Auth.GetFloat("grade")

	// Registration only asks for an email and a grade, so the cohort starts as
	// everyone and narrows to the programme once a transcript names it. Ranking
	// against a mixed population is worse than ranking against a matched one,
	// but it is far better than refusing to answer at all.
	// ?scope=overall looks at everyone without discarding the programme, so
	// switching the view back and forth never costs the user their setting.
	scoped := program != "" && degree != "" && e.Request.URL.Query().Get("scope") != "overall"

	total, err := e.App.CountRecords(usersCollection, cohort(program, degree, scoped))
	if err != nil {
		return e.InternalServerError("Failed to count the program.", err)
	}

	// Grades are constrained to 1.0-5.0, so 0 is unreachable for a submitted one.
	if grade == 0 {
		return e.JSON(200, &response{Scope: scopeName(scoped), Total: total})
	}

	better, err := e.App.CountRecords(usersCollection, cohort(program, degree, scoped), dbx.NewExp(
		"grade < {:grade}", dbx.Params{"grade": grade},
	))
	if err != nil {
		return e.InternalServerError("Failed to rank the grade.", err)
	}

	// Counting strictly better grades rather than positions means everyone on the
	// same grade shares a rank, which is the only fair reading when the grade is
	// all we know about them.
	rank := better + 1

	// The "top N %" figure, so lower is better and rank 1 is never 0%.
	percentile := math.Round(float64(rank)/float64(total)*1000) / 10

	out := &response{
		Scope:      scopeName(scoped),
		Grade:      &grade,
		Rank:       &rank,
		Total:      total,
		Percentile: &percentile,
	}
	if scoped {
		out.Program, out.Degree = &program, &degree
	}

	return e.JSON(200, out)
}

func scopeName(scoped bool) string {
	if scoped {
		return "program"
	}

	return "overall"
}

// cohort is what the total and the rank are measured against: everyone with a
// grade, or just the matching programme and degree once those are known.
//
// Degree is part of the key because a Master intake has already been filtered on
// its Bachelor result: those grades sit better, and mixing them would rank a
// Bachelor student against a population they are not in.
func cohort(program, degree string, scoped bool) dbx.Expression {
	if !scoped {
		return dbx.NewExp("grade > 0")
	}

	return dbx.NewExp(
		"program = {:program} AND degree = {:degree} AND grade > 0",
		dbx.Params{"program": program, "degree": degree},
	)
}
