// Package rank answers where the signed-in user stands among their peers.
//
//	GET /api/rank -> {"scope":"program","program":"Maschinenbau","degree":"Bachelor","grade":2.3,"rank":58,"total":240,"percentile":24.2}
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

// response is the wire shape. Everything but total is nullable because an
// account exists from its first login, long before it has a transcript.
type response struct {
	// Scope says what the rank is measured against: "program" once the
	// programme and degree are known, "overall" until then.
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
// Everything comes from transcripts and nothing from the account. A person
// collects several over their studies — a Bachelor, later a Master, a re-upload
// after a semester — so the account cannot hold "their" programme or grade
// without contradicting one of the documents.
//
// The cohort is one row per person: each user's most recent transcript. Ranking
// the transcripts themselves would count anyone who uploaded twice twice.
func handleRank(e *core.RequestEvent) error {
	mine, err := latest(e.App, e.Auth.Id)
	if err != nil {
		return e.InternalServerError("Failed to read the transcript.", err)
	}
	if mine == nil {
		return e.JSON(200, &response{Scope: "overall"})
	}

	program := mine.GetString("program")
	degree := mine.GetString("degree")
	grade := mine.GetFloat("grade")

	// ?scope=overall looks at everyone without discarding the programme, so
	// switching the view back and forth never costs the user their setting.
	scoped := program != "" && degree != "" && e.Request.URL.Query().Get("scope") != "overall"

	total, err := count(e.App, program, degree, scoped, 0)
	if err != nil {
		return e.InternalServerError("Failed to count the cohort.", err)
	}

	// Grades are constrained to 1.0-5.0, so 0 is unreachable for a real one.
	if grade == 0 {
		return e.JSON(200, &response{Scope: scopeName(scoped), Total: total})
	}

	better, err := count(e.App, program, degree, scoped, grade)
	if err != nil {
		return e.InternalServerError("Failed to rank the grade.", err)
	}

	// Counting strictly better grades rather than positions means everyone on
	// the same grade shares a rank, which is the only fair reading when the
	// grade is all we know about them.
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

// latest returns the caller's most recent transcript, or nil when they have
// none. Most recent rather than merged: someone who finishes a Bachelor and
// starts a Master belongs in the Master cohort.
func latest(app core.App, userID string) (*core.Record, error) {
	found, err := app.FindRecordsByFilter(
		"transcripts",
		"user = {:user}",
		"-uploaded",
		1,
		0,
		dbx.Params{"user": userID},
	)
	if err != nil || len(found) == 0 {
		return nil, err
	}

	return found[0], nil
}

// count sizes the cohort, or the part of it doing strictly better than grade.
//
// The subquery is what keeps this one row per person: it picks each user's most
// recent transcript before any of the filtering happens, so someone who
// uploaded three times is still counted once.
func count(app core.App, program, degree string, scoped bool, better float64) (int64, error) {
	query := app.DB().
		Select("COUNT(*)").
		From("transcripts t").
		Where(dbx.NewExp("t.grade > 0")).
		AndWhere(dbx.NewExp(
			"t.id = (SELECT id FROM transcripts WHERE user = t.user ORDER BY uploaded DESC LIMIT 1)",
		))

	if scoped {
		query = query.AndWhere(dbx.NewExp(
			"t.program = {:program} AND t.degree = {:degree}",
			dbx.Params{"program": program, "degree": degree},
		))
	}
	if better > 0 {
		query = query.AndWhere(dbx.NewExp("t.grade < {:grade}", dbx.Params{"grade": better}))
	}

	var total int64
	err := query.Row(&total)

	return total, err
}

func scopeName(scoped bool) string {
	if scoped {
		return "program"
	}

	return "overall"
}
