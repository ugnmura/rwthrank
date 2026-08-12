package rank

import (
	"strings"
	"testing"
)

func TestUnfiltered(t *testing.T) {
	// Nothing narrowed, every semester: the printed Gesamtnote is the honest
	// answer and the computed one would contradict the document.
	if !unfiltered(compareBody{StudySemester: -1}) {
		t.Error("an empty request was treated as narrowed")
	}

	narrowed := []struct {
		name string
		body compareBody
	}{
		{"a class", compareBody{StudySemester: -1, Courses: []string{"c1"}}},
		{"a semester", compareBody{StudySemester: -1, Semesters: []string{"24S"}}},
		{"a floor on credits", compareBody{StudySemester: -1, MinCredits: 5}},
		{"a ceiling on credits", compareBody{StudySemester: -1, MaxCredits: 5}},
		{"one semester of study", compareBody{StudySemester: 3}},
	}

	for _, c := range narrowed {
		if unfiltered(c.body) {
			t.Errorf("%s: a narrowed request was treated as unfiltered", c.name)
		}
	}
}

func TestFiltersBindEveryValue(t *testing.T) {
	// Everything from the request body goes in as a bound parameter. A course
	// id spliced into the SQL would be an injection; this is the test that
	// notices if one ever is.
	body := compareBody{
		Courses:       []string{"'; DROP TABLE results; --", "c2"},
		Semesters:     []string{"24S' OR '1'='1", "23W"},
		MinCredits:    5,
		MaxCredits:    10,
		StudySemester: 3,
		Program:       "Informatik'--",
		Degree:        "Bachelor",
	}

	where, params := filters(body)

	for _, value := range []string{"DROP TABLE", "OR '1'='1", "Informatik'--"} {
		if strings.Contains(where, value) {
			t.Fatalf("a request value reached the SQL text: %q in %q", value, where)
		}
	}

	// Every placeholder in the clause has to have a value bound to it, or the
	// query fails at runtime rather than here.
	for name := range params {
		if !strings.Contains(where, "{:"+name+"}") {
			t.Errorf("bound %q but never used it", name)
		}
	}

	found := 0
	for _, want := range []any{"'; DROP TABLE results; --", "c2", "24S' OR '1'='1", "23W", "Informatik'--"} {
		for _, got := range params {
			if got == want {
				found++
				break
			}
		}
	}
	if found != 5 {
		t.Errorf("bound %d of the 5 request values, so one was dropped or inlined", found)
	}
}

func TestFiltersKeyEachValueSeparately(t *testing.T) {
	// The keys are built from the index. Twenty-seven classes used to collide
	// at "ca" and quietly filter on the wrong one.
	many := make([]string, 30)
	for i := range many {
		many[i] = string(rune('a'+i%26)) + string(rune('0'+i/26))
	}

	_, params := filters(compareBody{Courses: many, StudySemester: -1})

	seen := map[any]bool{}
	for _, value := range params {
		if seen[value] {
			t.Fatalf("a value was bound twice, so two placeholders share a key: %v", value)
		}
		seen[value] = true
	}
	if len(params) != len(many) {
		t.Fatalf("bound %d keys for %d classes", len(params), len(many))
	}
}

func TestFiltersOnlyNarrowWhenAsked(t *testing.T) {
	where, params := filters(compareBody{StudySemester: -1})

	if where != "1 = 1" {
		t.Errorf("an unnarrowed request produced %q", where)
	}
	if len(params) != 0 {
		t.Errorf("an unnarrowed request bound %d parameters", len(params))
	}
}

func TestFiltersIgnoreHalfAProgramme(t *testing.T) {
	// A programme without a degree would silently compare a Bachelor against a
	// Master, which are ranked apart everywhere else.
	where, _ := filters(compareBody{StudySemester: -1, Program: "Informatik"})
	if strings.Contains(where, "transcripts") {
		t.Error("a programme with no degree still restricted the cohort")
	}

	where, _ = filters(compareBody{StudySemester: -1, Degree: "Master"})
	if strings.Contains(where, "transcripts") {
		t.Error("a degree with no programme still restricted the cohort")
	}
}

func TestNumberedResultsExcludesUngradedRows(t *testing.T) {
	// A pass without a mark, a module worth no credits, and a row with no
	// semester all have to stay out of a credit-weighted average.
	for _, clause := range []string{"grade IS NOT NULL", "credits > 0", "semester != ''"} {
		if !strings.Contains(numberedResults, clause) {
			t.Errorf("the numbered view no longer filters on %q", clause)
		}
	}
}
