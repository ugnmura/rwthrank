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
	Average *float64 `json:"average"`
	Credits float64  `json:"credits"`
	Courses int      `json:"courses"`
	// Official marks the figure as the Gesamtnote printed on the document
	// rather than one computed from the classes, which are not the same thing.
	Official      bool     `json:"official"`
	Rank          *int64   `json:"rank"`
	Total         int64    `json:"total"`
	Percentile    *float64 `json:"percentile"`
	CohortAverage *float64 `json:"cohortAverage"`
	CohortMedian  *float64 `json:"cohortMedian"`
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

	// With nothing narrowed, the honest answer is the number the university
	// printed. RWTH computes a Gesamtnote over the Modulbereich totals, not the
	// individual classes, so averaging the classes gives a different figure —
	// 1.48 against a printed 1.6 on the sample. Recomputing it would put a
	// number on screen that contradicts the student's own transcript.
	if unfiltered(body) {
		return officialAverage(e)
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
	// No row means the filter picks nothing the caller has. That is a question
	// worth answering rather than an empty screen: a semester they have not
	// reached yet still has other people in it, and what those people scored is
	// the reason to ask about it at all. Everything below runs either way; only
	// the placement needs a grade of one's own.
	hasMine := e.App.DB().
		NewQuery("SELECT avg, credits, courses FROM ("+averages+") a WHERE a.user = {:me}").
		Bind(mineParams).
		One(&mine) == nil

	if hasMine {
		out.Average, out.Credits, out.Courses = &mine.Avg, mine.Credits, mine.Courses
	}

	var totals struct {
		Total  int64   `db:"total"`
		Better int64   `db:"better"`
		Cohort float64 `db:"cohort"`
	}
	cohortParams := dbx.Params{"mine": mine.Avg}
	for k, v := range params {
		cohortParams[k] = v
	}
	err := e.App.DB().
		// COALESCE because a filter matching nobody makes SUM and AVG return
		// NULL over the empty set, and a null does not scan into a number.
		NewQuery(`SELECT COUNT(*) AS total,
		                 COALESCE(SUM(CASE WHEN a.avg < {:mine} THEN 1 ELSE 0 END), 0) AS better,
		                 COALESCE(AVG(a.avg), 0) AS cohort
		          FROM (` + averages + `) a`).
		Bind(cohortParams).
		One(&totals)
	if err != nil {
		return e.InternalServerError("Failed to compare.", err)
	}

	out.Total = totals.Total
	// Withheld when the group is one person: see privacy.go.
	if mayReveal(totals.Total, hasMine) {
		out.CohortAverage = &totals.Cohort
	}

	if hasMine {
		rank := totals.Better + 1
		percentile := math.Round(float64(rank)/float64(totals.Total)*1000) / 10
		out.Rank, out.Percentile = &rank, &percentile
	}

	if mayReveal(totals.Total, hasMine) {
		stats, err := statsOver(e.App, "SELECT a.avg AS value FROM ("+averages+") a", params)
		if err == nil {
			out.CohortMedian = &stats.Median
		}
	}

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

// unfiltered reports whether the request narrows anything at all.
func unfiltered(body compareBody) bool {
	return len(body.Courses) == 0 &&
		len(body.Semesters) == 0 &&
		body.MinCredits == 0 &&
		body.MaxCredits == 0 &&
		body.StudySemester < 0
}

// officialAverage answers with the printed Gesamtnote and ranks it the way the
// dashboard does, so the two screens never disagree about the same number.
func officialAverage(e *core.RequestEvent) error {
	mine, err := latestTranscript(e.App, e.Auth.Id)
	if err != nil || mine == nil {
		return e.JSON(http.StatusOK, &compareResponse{})
	}

	grade := mine.GetFloat("grade")
	credits := mine.GetFloat("credits")
	if grade == 0 {
		return e.JSON(http.StatusOK, &compareResponse{Credits: credits})
	}

	// The printed grade is not computed from the module rows, but the rows are
	// still what it covers, so the count belongs with it. Without this the
	// unfiltered view claims nought classes next to a full credit total.
	var counted int
	e.App.DB().
		NewQuery(`SELECT COUNT(*) FROM results
		          WHERE transcript = {:transcript} AND grade IS NOT NULL`).
		Bind(dbx.Params{"transcript": mine.Id}).
		Row(&counted)

	var totals struct {
		Total  int64   `db:"total"`
		Better int64   `db:"better"`
		Cohort float64 `db:"cohort"`
	}
	err = e.App.DB().
		NewQuery(`SELECT COUNT(*) AS total,
		                 SUM(CASE WHEN t.grade < {:mine} THEN 1 ELSE 0 END) AS better,
		                 AVG(t.grade) AS cohort
		          FROM transcripts t
		          WHERE t.grade IS NOT NULL
		            AND t.id = (SELECT id FROM transcripts WHERE user = t.user ORDER BY uploaded DESC LIMIT 1)`).
		Bind(dbx.Params{"mine": grade}).
		One(&totals)
	if err != nil {
		return e.InternalServerError("Failed to compare.", err)
	}

	rank := totals.Better + 1
	percentile := math.Round(float64(rank)/float64(totals.Total)*1000) / 10

	result := &compareResponse{
		Average:    &grade,
		Credits:    credits,
		Courses:    counted,
		Official:   true,
		Rank:       &rank,
		Total:      totals.Total,
		Percentile: &percentile,
	}
	if mayReveal(totals.Total, true) {
		result.CohortAverage = &totals.Cohort
	}

	if mayReveal(totals.Total, true) {
		stats, err := statsOver(e.App, `
			SELECT t.grade AS value FROM transcripts t
			WHERE t.grade IS NOT NULL
			  AND t.id = (SELECT id FROM transcripts WHERE user = t.user ORDER BY uploaded DESC LIMIT 1)`,
			dbx.Params{})
		if err == nil {
			result.CohortMedian = &stats.Median
		}
	}

	return e.JSON(http.StatusOK, result)
}

// latestTranscript is the caller's most recent document.
func latestTranscript(app core.App, userID string) (*core.Record, error) {
	found, err := app.FindRecordsByFilter(
		"transcripts", "user = {:user}", "-uploaded", 1, 0,
		dbx.Params{"user": userID},
	)
	if err != nil || len(found) == 0 {
		return nil, err
	}

	return found[0], nil
}
