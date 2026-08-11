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
	Program    *string  `json:"program"`
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

// handleRank ranks the caller within their own programme.
//
// Grades only mean something next to the same programme's: a 2.0 in Maschinenbau
// and a 2.0 in Medizin are not the same achievement, so the cohort is always the
// authenticated user's program and never the whole table.
//
// An incomplete profile is a normal state, not an error — the frontend reads the
// null fields as "show the form instead of the dashboard".
func handleRank(e *core.RequestEvent) error {
	// Only the users collection carries these fields; a superuser token falls
	// through the empty checks below and gets the not-set answer.
	program := e.Auth.GetString("program")
	grade := e.Auth.GetFloat("grade")

	if program == "" {
		return e.JSON(200, &response{})
	}

	total, err := e.App.CountRecords(usersCollection, graded(program))
	if err != nil {
		return e.InternalServerError("Failed to count the program.", err)
	}

	// Grades are constrained to 1.0-5.0, so 0 is unreachable for a submitted one.
	if grade == 0 {
		return e.JSON(200, &response{Total: total})
	}

	better, err := e.App.CountRecords(usersCollection, graded(program), dbx.NewExp(
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

	return e.JSON(200, &response{
		Program:    &program,
		Grade:      &grade,
		Rank:       &rank,
		Total:      total,
		Percentile: &percentile,
	})
}

// graded matches the users in a program who have submitted a grade, which is the
// cohort both the total and the rank are measured against.
func graded(program string) dbx.Expression {
	return dbx.NewExp(
		"program = {:program} AND grade > 0",
		dbx.Params{"program": program},
	)
}
