// Package transcript reads an RWTH Aachen "Notenspiegel" (transcript of
// records) and returns the grades it lists.
//
// The document has no machine-readable layer, so everything here is recovered
// from the printed table. A Notenspiegel is a flat list — nothing is indented —
// in which three kinds of line look identical:
//
//	Modulbereich Konstruktionstechnik|1,5|N|27,00|12.08.2025   a total
//	Programmierung|1,7|N|8,00|07.02.2024                        a module
//	Programmierung|1,7|BE|N|8,00|07.02.2024|23W                 an attempt
//
// Telling them apart is what most of this package does; see modules.
//
// The same transcript is printed twice, German first and then in English with
// ISO dates and decimal points. Only the German half is parsed — the English
// column header never matches, so its rows are never collected and the module
// list does not come out doubled.
package transcript

import (
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

// ErrNotNotenspiegel reports that the file was read but is not a transcript.
// Callers that serve uploads should treat it as a client error.
// ErrWouldReplace is returned when an upload would replace a stored transcript
// and the caller has not said that is what they want.
var ErrWouldReplace = errors.New("would replace a stored transcript")

// ErrOlderTranscript is returned when an upload predates the stored one.
var ErrOlderTranscript = errors.New("the stored transcript is newer")

var ErrNotNotenspiegel = errors.New("not an RWTH Notenspiegel")

// Transcript is the summary of a Notenspiegel plus every module it lists.
type Transcript struct {
	// Issued is the date printed on the document, which is what makes one
	// transcript newer than another. Upload time would not: a PDF exported last
	// year can be uploaded today.
	Issued     string   // "2026-08-11", empty when the header has no date
	Program    string   // e.g. "Maschinenbau"
	Degree     string   // "Bachelor" or "Master", empty when the line does not say
	Grade      float64  // Gesamtnote, e.g. 2.3
	Credits    float64  // Gesamtcredits earned so far
	MaxCredits float64  // credits the programme requires
	Modules    []Module // individual modules, without the totals they roll up into
}

// Module is one module of the programme, as opposed to a Modulbereich total or
// a single examination attempt.
type Module struct {
	Name string
	// NameEn is the same class as the English half names it, empty when that
	// half is missing or shorter than the German one.
	NameEn   string
	Grade    float64 // 0 when ungraded (a "B" pass)
	Passed   bool
	Credits  float64
	Semester string // e.g. "23W", empty when no attempt row carried one
}

// Line is one visual line of a page, already split into the columns the reader
// printed. Cells are never empty and never padded, so a line with no Vermerk
// simply has one cell fewer.
type Line struct {
	Page  int
	Y     float64
	Cells []string
}

// textExtractor turns a PDF into positioned lines of text. The Notenspiegel
// parsing below works only on Lines, so swapping the PDF library out means
// replacing one implementation of this and nothing else.
type textExtractor interface {
	Lines(r io.ReaderAt, size int64) ([]Line, error)
}

// extractor is the extractor Parse uses. A variable so tests can substitute one.
var extractor textExtractor = pdfExtractor{}

// Parse reads a Notenspiegel PDF.
func Parse(r io.ReaderAt, size int64) (*Transcript, error) {
	lines, err := extractor.Lines(r, size)
	if err != nil {
		return nil, err
	}

	return parseLines(lines)
}

const (
	// tableHeader is the first cell of the row that introduces the grade table.
	// It is also the marker that the German half of the document has started.
	tableHeader = "Module/Fächer"

	// englishTableHeader introduces the same table in the English half. RWTH
	// prints every Notenspiegel twice, the second time translated, so the
	// English name of every class is already in the document.
	englishTableHeader = "Modules/Courses"

	// englishProgramLabel is the English half's version of programLabel.
	englishProgramLabel = "Course of Study:"

	// programLabel labels the field whose value line carries the programme.
	programLabel = "Studiengang:"

	// ungraded is the Note of a module passed without a mark ("bestanden").
	ungraded = "B"

	// passedMark is the Vermerk of an attempt that was passed.
	passedMark = "BE"

	// worstPassingGrade is 4,0; 5,0 is the only failing grade on the scale.
	worstPassingGrade = 4.0

	// continuationGap is how far below its row a wrapped name can sit. A name
	// too long for the column continues on a second line set with the usual
	// 10pt leading, while consecutive rows are 16pt or more apart.
	continuationGap = 13.0
)

var (
	creditsSummaryRe = regexp.MustCompile(`^Gesamtcredits:\s*([\d.,]+)\s*/\s*([\d.,]+)`)
	gradeSummaryRe   = regexp.MustCompile(`^Gesamtnote:\s*([\d.,]+)`)
	// "Datum: 11.08.2026" in the header of every page.
	issuedRe = regexp.MustCompile(`^Datum:\s*(\d{2})\.(\d{2})\.(\d{4})`)
)

// parseLines walks the document top to bottom and collects the grade table.
func parseLines(lines []Line) (*Transcript, error) {
	var (
		t                  Transcript
		rows               []tableRow
		page               int
		inTable            bool
		wantProgram        bool
		wantEnglishProgram bool
		inEnglish          bool
		englishProgram     string
		englishRows        []tableRow
		lastY              float64
	)

	for _, line := range lines {
		if len(line.Cells) == 0 {
			continue
		}

		if line.Page != page {
			// Every page repeats the column header, and the running header above
			// it — name, student number, print date — parses as a plausible row.
			// Re-entering the table only on the header keeps that line out.
			page, inTable, lastY = line.Page, false, 0
		}

		first := line.Cells[0]

		switch {
		case wantProgram:
			// The label sits above its value and the value line is shared with
			// the degree, so the programme is the first column one line down and
			// the awarded degree is the second.
			t.Program, wantProgram = first, false
			if len(line.Cells) > 1 {
				t.Degree = degreeOf(line.Cells[1])
			}
			continue

		case t.Issued == "" && issuedRe.MatchString(first):
			// Stored sorted, so string comparison orders two documents.
			m := issuedRe.FindStringSubmatch(first)
			t.Issued = m[3] + "-" + m[2] + "-" + m[1]
			continue

		case t.Program == "" && strings.HasPrefix(first, programLabel):
			wantProgram = true
			continue

		case first == tableHeader:
			inTable = true
			continue

		case first == englishTableHeader:
			// Everything from here is the translated copy of the same table.
			inTable, inEnglish = true, true
			continue

		case wantEnglishProgram:
			englishProgram, wantEnglishProgram = first, false
			continue

		case englishProgram == "" && strings.HasPrefix(first, englishProgramLabel):
			wantEnglishProgram = true
			continue

		case creditsSummaryRe.MatchString(first):
			m := creditsSummaryRe.FindStringSubmatch(first)
			t.Credits, t.MaxCredits = decimal(m[1]), decimal(m[2])
			inTable = false // the summary is printed below the last row
			continue

		case gradeSummaryRe.MatchString(first):
			t.Grade = decimal(gradeSummaryRe.FindStringSubmatch(first)[1])
			inTable = false
			continue

		case !inTable:
			continue
		}

		// A name too long for its column wraps onto a line of its own.
		if len(line.Cells) == 1 && lastY-line.Y > 0 && lastY-line.Y <= continuationGap {
			if inEnglish && len(englishRows) > 0 {
				englishRows[len(englishRows)-1].name += " " + first
				lastY = line.Y
				continue
			}
			if !inEnglish && len(rows) > 0 {
				rows[len(rows)-1].name += " " + first
				lastY = line.Y
				continue
			}
		}

		row, ok := parseRow(line.Cells)
		if !ok || (row.ang == "" && row.date == "") {
			continue // page numbers and other stray text between the rows
		}
		if inEnglish {
			englishRows = append(englishRows, row)
		} else {
			rows = append(rows, row)
		}
		lastY = line.Y
	}

	if t.Program == "" {
		return nil, fmt.Errorf("%w: no %q field", ErrNotNotenspiegel, programLabel)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: no %q table", ErrNotNotenspiegel, tableHeader)
	}

	// A transcript printed before the programme is finished may have no
	// Gesamtnote line, but its programme row always carries the running totals.
	for _, row := range rows {
		if row.name != t.Program {
			continue
		}
		if t.Grade == 0 {
			t.Grade = decimal(row.note)
		}
		if t.Credits == 0 {
			t.Credits = decimal(row.credits)
		}
		break
	}

	t.Modules = modules(rows, t.Program)

	// The English half is the same table translated, printed in the same order,
	// so the nth class in one is the nth in the other. Names are paired by
	// position rather than matched on anything, because nothing in a translated
	// name is stable enough to match on.
	if english := modules(englishRows, englishProgram); len(english) == len(t.Modules) {
		for i := range t.Modules {
			t.Modules[i].NameEn = english[i].Name
		}
	}

	return &t, nil
}

// tableRow is one row of the grade table with its columns identified.
type tableRow struct {
	name     string
	note     string // "1,7", "B", "Q" or empty
	vm       string // Vermerk: "BE", "NB", ...
	ang      string // angerechnete Leistung: J, N or T
	credits  string
	date     string
	semester string
}

// attempt reports whether the row records a single examination attempt rather
// than a total. Only attempts carry a Vermerk.
func (r tableRow) attempt() bool { return r.vm != "" }

// columns are the value columns in printed order, each with a test for a cell
// that could belong to it. Marks are matched before the "angerechnete Leistung"
// flag because "N" alone is not a Vermerk, and grades before credits because
// only credits are printed with two decimals.
//
// Every numeric pattern accepts both notations: the document prints the same
// table twice, German with decimal commas and English with decimal points.
var columns = []struct {
	field func(*tableRow) *string
	match func(string) bool
}{
	{func(r *tableRow) *string { return &r.note }, regexp.MustCompile(`^([1-5][,.]\d|B|Q)$`).MatchString},
	{func(r *tableRow) *string { return &r.vm }, isVermerk},
	{func(r *tableRow) *string { return &r.ang }, regexp.MustCompile(`^[JNT]$`).MatchString},
	{func(r *tableRow) *string { return &r.credits }, regexp.MustCompile(`^(\d{1,3}(\.\d{3})*,\d{2}|\d{1,3}(,\d{3})*\.\d{2})$`).MatchString},
	// Both notations: the German half prints 07.02.2024 and the English
	// half the same day as 2024-02-07.
	{func(r *tableRow) *string { return &r.date }, regexp.MustCompile(`^(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})$`).MatchString},
	{func(r *tableRow) *string { return &r.semester }, regexp.MustCompile(`^\d{2}[WS]$`).MatchString},
}

// vermerke are the annotations the legend on the last page lists. Recognising
// them by name is what separates the Vermerk column from its neighbours.
var vermerke = map[string]bool{
	"AN": true, "BE": true, "NB": true, "X": true, "PA": true, "Q": true,
	"U": true, "NZ": true, "A": true, "PAQ": true, "R": true, "S": true,
	"TS": true, "M": true, "G": true, "GA": true, "GL": true, "E": true,
	"NU": true, "TR": true, "NA": true,
}

func isVermerk(s string) bool { return vermerke[s] }

// parseRow assigns a row's cells to columns.
//
// Columns are not padded — an unfinished module has no Vermerk, a heading has
// no credits — so a cell cannot be identified by its position. What is fixed is
// their order, so each cell is matched against the remaining columns in turn.
// Anything before the first match is part of the name, which is how a name
// split by an unusually wide gap is put back together.
func parseRow(cells []string) (tableRow, bool) {
	if len(cells) == 0 {
		return tableRow{}, false
	}

	row := tableRow{name: cells[0]}
	next := 0

	for _, cell := range cells[1:] {
		matched := false
		for i := next; i < len(columns); i++ {
			if columns[i].match(cell) {
				*columns[i].field(&row) = cell
				next, matched = i+1, true
				break
			}
		}
		if matched {
			continue
		}
		if next > 0 {
			return tableRow{}, false // unreadable cell after a real column
		}
		row.name += " " + cell
	}

	return row, true
}

// degreeOf reads the degree out of the line the programme shares.
//
// The cell spells out the full award ("Bachelor of Science RWTH Aachen
// University"), and only the level matters for ranking, since a Master intake is
// already filtered on its Bachelor result.
func degreeOf(cell string) string {
	lower := strings.ToLower(cell)

	switch {
	case strings.Contains(lower, "master"):
		return "Master"
	case strings.Contains(lower, "bachelor"):
		return "Bachelor"
	default:
		return ""
	}
}

// modules picks the individual modules out of the table.
//
// The table is flat, so a module and the Modulbereich total above it are the
// same shape. Two independent signals mark a row as a total, and a row is kept
// only if neither fires:
//
//   - Structure: a module is always followed directly by the attempt rows that
//     earned it, so a roll-up whose next row is another roll-up is a total.
//     This is the load-bearing rule and it is language independent — it is the
//     only thing that catches a heading like "Medizin" or "Nicht-technisches
//     Wahlfach", whose name says nothing about what it is.
//   - Naming: the programme itself and the headings the RWTH template emits
//     ("Modulbereich ...", "Wahlpflichtbereich ...", "Module im ...",
//     "Anwendungsbereich ..."). A backstop for a total that is followed by an
//     attempt row anyway, e.g. if a module ever lost its own roll-up.
//
// On the sample the two agree on every row, and the credits of what survives
// sum to exactly the Gesamtcredits — which is what the test asserts, since that
// is the only check that catches a total leaking in or a module dropping out.
func modules(rows []tableRow, program string) []Module {
	var out []Module

	for i, row := range rows {
		if row.attempt() || isTotal(rows, i, program) {
			continue
		}

		grade := decimal(row.note) // 0 for a "B" pass, which has no mark
		m := Module{
			Name:    row.name,
			Grade:   grade,
			Credits: decimal(row.credits),
			Passed:  row.note == ungraded || (grade > 0 && grade <= worstPassingGrade),
		}

		// The roll-up carries no Vermerk and no semester; both come from the
		// attempts below it. A retaken module has several, and it is the one
		// that was passed that says when the module was finished.
		for j := i + 1; j < len(rows) && rows[j].attempt(); j++ {
			if rows[j].vm == passedMark {
				m.Passed = true
				m.Semester = rows[j].semester
			} else if m.Semester == "" {
				m.Semester = rows[j].semester
			}
		}

		out = append(out, m)
	}

	return out
}

// isTotal reports whether rows[i] is a heading or a subtotal. See modules.
func isTotal(rows []tableRow, i int, program string) bool {
	// Nothing below it to have earned it. Every module has attempts, so the row
	// that closes the table is a total.
	if i+1 >= len(rows) || !rows[i+1].attempt() {
		return true
	}

	name := rows[i].name
	if name == program {
		return true
	}
	for _, prefix := range []string{"Modulbereich", "Wahlpflichtbereich", "Module im ", "Anwendungsbereich"} {
		if strings.HasPrefix(name, prefix) {
			return true
		}
	}

	return false
}

// decimal reads a German-formatted number: comma for the decimal point, dot for
// thousands. Anything unparsable — "B", "Q", an empty cell — reads as 0.
func decimal(s string) float64 {
	s = strings.TrimSpace(s)

	// The same number is printed both ways: 1.024,00 in the German half and
	// 1,024.00 in the English one. Whichever separator comes last is the
	// decimal point, and the other is grouping.
	if strings.LastIndex(s, ",") > strings.LastIndex(s, ".") {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		s = strings.ReplaceAll(s, ",", "")
	}

	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}

	return v
}

// columnGapEm is the horizontal gap, as a multiple of the font size, that means
// a new column rather than the next letter.
//
// Fragments arrive one glyph at a time and carry no width, so the gap has to be
// measured between origins: within a word that is at most the advance of the
// widest glyph (~0.95em, and 0 for the runs the reader cannot measure), while
// the narrowest gap between two columns of the table is about 3em.
const columnGapEm = 1.2

// fragment is one positioned piece of text, independent of any PDF library.
type fragment struct {
	x, y, size float64
	s          string
}

// groupLines rebuilds the printed lines of a page from its text fragments.
//
// Reading order in the content stream is not the order on the page — the
// two-column header comes out interleaved — so lines are rebuilt from geometry:
// group by baseline, sort by x, and cut a new cell wherever the gap is too wide
// to be a letter.
func groupLines(page int, frags []fragment) []Line {
	byBaseline := map[float64][]fragment{}
	for _, f := range frags {
		byBaseline[math.Round(f.y)] = append(byBaseline[math.Round(f.y)], f)
	}

	baselines := make([]float64, 0, len(byBaseline))
	for y := range byBaseline {
		baselines = append(baselines, y)
	}
	// PDF y grows upwards, so the top of the page sorts last.
	sort.Sort(sort.Reverse(sort.Float64Slice(baselines)))

	lines := make([]Line, 0, len(baselines))
	for _, y := range baselines {
		row := byBaseline[y]
		// Stable: glyphs of a run the reader could not measure all share an x
		// and must keep the order they were written in.
		sort.SliceStable(row, func(i, j int) bool { return row[i].x < row[j].x })

		var (
			cells []string
			cell  strings.Builder
			prev  fragment
		)
		flush := func() {
			if c := cleanCell(cell.String()); c != "" {
				cells = append(cells, c)
			}
			cell.Reset()
		}
		for i, f := range row {
			if i > 0 && f.x-prev.x > columnGapEm*math.Max(f.size, prev.size) {
				flush()
			}
			cell.WriteString(f.s)
			prev = f
		}
		flush()

		if len(cells) > 0 {
			lines = append(lines, Line{Page: page, Y: y, Cells: cells})
		}
	}

	return lines
}

// cleanCell drops the replacement characters the reader leaves behind.
//
// They are not letters — umlauts decode fine — but the glyph that ends every
// run has no ToUnicode entry and arrives as U+FFFD. Cells are cut on geometry
// precisely so that this never matters.
func cleanCell(s string) string {
	return strings.TrimSpace(strings.Map(func(r rune) rune {
		if r == unicode.ReplacementChar {
			return -1
		}
		return r
	}, s))
}
