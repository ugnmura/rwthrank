package rank

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// cohortStats is the shape of a group of grades: what it averages, and the
// grade in the middle of it.
//
// Both are worth showing because they answer different questions. An average
// moves with a handful of very good or very bad results; the median says what
// the ordinary case looks like, which is usually what someone asking "how am I
// doing" wants to know.
type cohortStats struct {
	Average float64 `db:"average"`
	Median  float64 `db:"median"`
}

// statsOver measures a query that yields one numeric column named "value".
//
// SQLite has no median, so it is the middle row of the ordered set: one row for
// an odd count, the mean of the middle two for an even one.
func statsOver(app core.App, values string, params dbx.Params) (cohortStats, error) {
	sql := `WITH v AS (` + values + `)
		SELECT
			(SELECT AVG(value) FROM v) AS average,
			(SELECT AVG(value) FROM (
				SELECT value FROM v
				ORDER BY value
				LIMIT 2 - ((SELECT COUNT(*) FROM v) % 2)
				OFFSET ((SELECT COUNT(*) FROM v) - 1) / 2
			)) AS median`

	var out cohortStats
	err := app.DB().NewQuery(sql).Bind(params).One(&out)

	return out, err
}
