package rank

import (
	"math"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// coursePath ranks the caller inside one class.
//
//	GET /api/rank/course/{id} -> {"course":"Datenstrukturen","grade":1.7,"rank":4,"total":21,"percentile":19}
//
// The cohort is everyone who has a grade in that course, one row per person.
// Somebody can hold the same course on two transcripts — a class that counts
// towards two degrees, or a re-upload — so the best grade they have in it is
// the one that represents them.
const coursePath = "/api/rank/course/{id}"

type courseResponse struct {
	Course        string   `json:"course"`
	CohortAverage *float64 `json:"cohortAverage"`
	CohortMedian  *float64 `json:"cohortMedian"`
	Grade         *float64 `json:"grade"`
	Rank          *int64   `json:"rank"`
	Total         int64    `json:"total"`
	Percentile    *float64 `json:"percentile"`
}

func handleCourseRank(e *core.RequestEvent) error {
	courseID := e.Request.PathValue("id")

	course, err := e.App.FindRecordById("courses", courseID)
	if err != nil {
		return e.NotFoundError("No such course.", err)
	}

	out := &courseResponse{Course: course.GetString("name")}

	total, err := countCourse(e.App, courseID, 0)
	if err != nil {
		return e.InternalServerError("Failed to count the class.", err)
	}
	out.Total = total

	// What the class looks like as a whole, shown whether or not the caller
	// sat it: the average moves with a few outliers, the median does not.
	if total > 0 {
		stats, err := statsOver(e.App, `
			SELECT MIN(grade) AS value
			FROM results
			WHERE course = {:course} AND grade IS NOT NULL
			GROUP BY user`, dbx.Params{"course": courseID})
		if err != nil {
			return e.InternalServerError("Failed to measure the class.", err)
		}
		out.CohortAverage, out.CohortMedian = &stats.Average, &stats.Median
	}

	// The caller's own standing in it, if they sat it at all.
	mine, err := bestInCourse(e.App, courseID, e.Auth.Id)
	if err != nil {
		return e.InternalServerError("Failed to read your grade.", err)
	}
	if mine == 0 {
		return e.JSON(http.StatusOK, out)
	}

	better, err := countCourse(e.App, courseID, mine)
	if err != nil {
		return e.InternalServerError("Failed to rank the grade.", err)
	}

	rank := better + 1
	percentile := math.Round(float64(rank)/float64(total)*1000) / 10

	out.Grade, out.Rank, out.Percentile = &mine, &rank, &percentile

	return e.JSON(http.StatusOK, out)
}

// bestInCourse is the caller's best grade in one course, or 0 when they have
// none. Lower is better on the German scale, so best is the minimum.
func bestInCourse(app core.App, courseID, userID string) (float64, error) {
	var grade float64

	err := app.DB().
		Select("MIN(grade)").
		From("results").
		Where(dbx.NewExp(
			"course = {:course} AND user = {:user} AND grade IS NOT NULL",
			dbx.Params{"course": courseID, "user": userID},
		)).
		Row(&grade)

	return grade, err
}

// countCourse sizes the class, or the part of it doing strictly better.
//
// Grouping by user before counting keeps it one row per person: anyone holding
// the course twice collapses to their best grade first. dbx has no helper for
// selecting from a subquery, so it is written out.
func countCourse(app core.App, courseID string, better float64) (int64, error) {
	sql := `SELECT COUNT(*) FROM (
		SELECT user, MIN(grade) AS best
		FROM results
		WHERE course = {:course} AND grade IS NOT NULL
		GROUP BY user
	) g`
	params := dbx.Params{"course": courseID}

	if better > 0 {
		sql += " WHERE g.best < {:grade}"
		params["grade"] = better
	}

	var total int64
	err := app.DB().NewQuery(sql).Bind(params).Row(&total)

	return total, err
}

func registerCourseRoute(se *core.ServeEvent) {
	se.Router.GET(coursePath, handleCourseRank).Bind(apis.RequireAuth())
}
