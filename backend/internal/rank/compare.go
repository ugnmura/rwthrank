package rank

import (
	"math"
	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// comparePath answers "how do I compare, over exactly these classes".
//
//	POST /api/compare
//	{"courses":["a","b"],"semesters":["24S"],"studySemester":3,"program":"Informatik","degree":"Bachelor"}
//	-> {"average":1.83,"credits":42,"courses":7,"rank":12,"total":240,"percentile":5,"cohortAverage":2.31}
//
// Averages are credit-weighted, the way a Gesamtnote is. An unweighted mean
// would disagree with the number printed on the student's own transcript, and
// then two figures claiming to be "your average" would be on screen at once.
const comparePath = "/api/compare"

type compareBody struct {
	Courses []string `json:"courses"`
	// Calendar semesters as the document writes them: 23W, 24S.
	Semesters []string `json:"semesters"`
	// Nth semester of study, counted from the earliest semester the person has
	// any result in. The document never states this, so it is inferred.
	//
	// Zero means the caller's own current semester, which is the default: the
	// question people actually ask is how they are doing now. Sending an
	// explicit number compares against a different one instead, and -1 drops
	// the restriction and looks at every semester at once.
	StudySemester int `json:"studySemester"`
	// Only count classes worth this many credits, so an average can be taken
	// over the big modules alone, or the small ones, or one exact size.
	MinCredits float64 `json:"minCredits"`
	MaxCredits float64 `json:"maxCredits"`
	Program    string  `json:"program"`
	Degree     string  `json:"degree"`
}

type compareResponse struct {
	Average       *float64 `json:"average"`
	Credits       float64  `json:"credits"`
	Courses       int      `json:"courses"`
	Rank          *int64   `json:"rank"`
	Total         int64    `json:"total"`
	Percentile    *float64 `json:"percentile"`
	CohortAverage *float64 `json:"cohortAverage"`
}

func handleCompare(e *core.RequestEvent) error {
	body := compareBody{}
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Could not read the filters.", err)
	}

	// Default: the semester the caller is actually in.
	if body.StudySemester == 0 {
		current, err := currentStudySemester(e.App, e.Auth.Id)
		if err != nil {
			return e.InternalServerError("Failed to work out your semester.", err)
		}
		body.StudySemester = current
	}

	where, params := filters(body)

	// One weighted average per person over the same filtered set, so everyone
	// is measured by the same rule the caller is.
	averages := `
		SELECT r.user AS user,
		       SUM(r.grade * r.credits) / NULLIF(SUM(r.credits), 0) AS avg,
		       SUM(r.credits) AS credits,
		       COUNT(*) AS courses
		FROM (` + numberedResults + `) r
		WHERE ` + where + `
		GROUP BY r.user
		HAVING SUM(r.credits) > 0`

	out := &compareResponse{}

	var mine struct {
		Avg     float64 `db:"avg"`
		Credits float64 `db:"credits"`
		Courses int     `db:"courses"`
	}
	mineParams := dbx.Params{"me": e.Auth.Id}
	for k, v := range params {
		mineParams[k] = v
	}
	err := e.App.DB().
		NewQuery("SELECT avg, credits, courses FROM (" + averages + ") a WHERE a.user = {:me}").
		Bind(mineParams).
		One(&mine)
	if err != nil {
		// No rows means the filters exclude everything the caller has.
		return e.JSON(http.StatusOK, out)
	}

	out.Average, out.Credits, out.Courses = &mine.Avg, mine.Credits, mine.Courses

	var totals struct {
		Total  int64   `db:"total"`
		Better int64   `db:"better"`
		Cohort float64 `db:"cohort"`
	}
	cohortParams := dbx.Params{"mine": mine.Avg}
	for k, v := range params {
		cohortParams[k] = v
	}
	err = e.App.DB().
		NewQuery(`SELECT COUNT(*) AS total,
		                 SUM(CASE WHEN a.avg < {:mine} THEN 1 ELSE 0 END) AS better,
		                 AVG(a.avg) AS cohort
		          FROM (` + averages + `) a`).
		Bind(cohortParams).
		One(&totals)
	if err != nil {
		return e.InternalServerError("Failed to compare.", err)
	}

	rank := totals.Better + 1
	percentile := math.Round(float64(rank)/float64(totals.Total)*1000) / 10

	out.Rank, out.Total, out.Percentile = &rank, totals.Total, &percentile
	out.CohortAverage = &totals.Cohort

	return e.JSON(http.StatusOK, out)
}

// currentStudySemester is how many semesters the caller has results in, which
// stands in for the one they are in now. A gap year would undercount it, but
// the document gives nothing better and the alternative is asking.
func currentStudySemester(app core.App, userID string) (int, error) {
	var n int
	err := app.DB().
		NewQuery(`SELECT COUNT(DISTINCT semester) FROM results
		          WHERE user = {:user} AND semester != ''`).
		Bind(dbx.Params{"user": userID}).
		Row(&n)

	if n == 0 {
		return -1, err // nothing to go on; compare across everything
	}

	return n, err
}

// numberedResults numbers each person's semesters from their own first one, so
// "third semester" means their third rather than a calendar date.
//
// Semesters sort correctly as strings — 23W, 24S, 24W — because the year leads
// and S precedes W within a year.
const numberedResults = `SELECT id, user, course, grade, credits, semester,
	       DENSE_RANK() OVER (PARTITION BY user ORDER BY semester) AS study_semester
	FROM results
	WHERE grade IS NOT NULL AND credits > 0 AND semester != ''`

// filters turns the request into a WHERE clause over the numbered view.
func filters(body compareBody) (string, dbx.Params) {
	clauses := []string{"1 = 1"}
	params := dbx.Params{}

	if len(body.Courses) > 0 {
		names := make([]string, 0, len(body.Courses))
		for i, id := range body.Courses {
			key := "c" + string(rune('a'+i%26)) + string(rune('a'+i/26))
			names = append(names, "{:"+key+"}")
			params[key] = id
		}
		clauses = append(clauses, "r.course IN ("+strings.Join(names, ",")+")")
	}

	if len(body.Semesters) > 0 {
		names := make([]string, 0, len(body.Semesters))
		for i, sem := range body.Semesters {
			key := "s" + string(rune('a'+i%26)) + string(rune('a'+i/26))
			names = append(names, "{:"+key+"}")
			params[key] = sem
		}
		clauses = append(clauses, "r.semester IN ("+strings.Join(names, ",")+")")
	}

	if body.MinCredits > 0 {
		clauses = append(clauses, "r.credits >= {:mincp}")
		params["mincp"] = body.MinCredits
	}
	if body.MaxCredits > 0 {
		clauses = append(clauses, "r.credits <= {:maxcp}")
		params["maxcp"] = body.MaxCredits
	}

	// -1 means every semester at once; a positive number picks one.
	if body.StudySemester > 0 {
		clauses = append(clauses, "r.study_semester = {:studysem}")
		params["studysem"] = body.StudySemester
	}

	// Narrowing to a programme means only counting people whose newest
	// transcript is in it, which is the same cohort the dashboard ranks against.
	if body.Program != "" && body.Degree != "" {
		clauses = append(clauses, `r.user IN (
			SELECT t.user FROM transcripts t
			WHERE t.program = {:program} AND t.degree = {:degree}
		)`)
		params["program"] = body.Program
		params["degree"] = body.Degree
	}

	return strings.Join(clauses, " AND "), params
}

func registerCompareRoute(se *core.ServeEvent) {
	se.Router.POST(comparePath, handleCompare).Bind(apis.RequireAuth())
}
