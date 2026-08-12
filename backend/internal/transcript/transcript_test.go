package transcript

import (
	"errors"
	"math"
	"os"
	"strings"
	"testing"
)

// sampleEnv points at a real Notenspiegel. The sample is one person's actual
// transcript, so it cannot live in the repository and the tests that need it
// skip when it is absent.
const (
	sampleEnv     = "RWTHRANK_SAMPLE_TRANSCRIPT"
	defaultSample = "../../../transcript.pdf"
)

// wrapMarker prefixes a fixture line that continues the name of the line above.
const wrapMarker = "~"

// fixture turns "a|b|c" lines into what the extractor would hand parseLines.
// Rows are set 16pt apart; a wrapped name sits 10pt below its row, which is the
// spacing the real document uses and the only thing that tells them apart.
func fixture(page int, rows ...string) []Line {
	lines := make([]Line, 0, len(rows))
	y := 800.0

	for _, row := range rows {
		gap := 16.0
		if strings.HasPrefix(row, wrapMarker) {
			row, gap = strings.TrimPrefix(row, wrapMarker), 10.0
		}
		y -= gap
		lines = append(lines, Line{Page: page, Y: y, Cells: strings.Split(row, "|")})
	}

	return lines
}

// invented transcript, made up start to finish.
func sampleLines() []Line {
	lines := fixture(1,
		"Zentrales Prüfungsamt",
		"Notenspiegel",
		"Nachname:|Vorname:",
		"Musterfrau|Erika",
		"Studiengang:|(angestrebter) Abschluss:",
		"Elektrotechnik|Bachelor of Science RWTH Aachen University",
		"~(B. Sc. RWTH)",
		"Module/Fächer|Note|Vm|Ang|CP|Datum|Sem",
		"Elektrotechnik|2,0|N|30,00",
		"Modulbereich Grundlagen|1,7|N|18,00|01.03.2025",
		"Höhere Mathematik|1,3|N|10,00|01.03.2024",
		"Höhere Mathematik I|1,3|BE|N|10,00|01.03.2024|23W",
		"Schaltungstechnik|2,0|N|8,00|01.08.2024",
		"Schaltungstechnik|5,0|NB|N|0,00|01.02.2024|23W",
		"Schaltungstechnik|2,0|BE|N|8,00|01.08.2024|24S",
		"1| / |2",
	)

	return append(lines, fixture(2,
		"Musterfrau, Erika|123456|01.03.2026",
		"Module/Fächer|Note|Vm|Ang|CP|Datum|Sem",
		"Modulbereich Praxis|B|N|12,00|01.09.2025",
		"Laborpraktikum mit einem Namen, der|B|N|12,00|01.09.2025",
		"~umbricht",
		"Laborpraktikum|B|BE|N|12,00|01.09.2025|25S",
		"Gesamtcredits: 30,00 / 210,00",
		"Gesamtnote: 2,0",
		"Notenspiegel|2| / |2",
		"RWTH Aachen University",
	)...)
}

func TestParseLines(t *testing.T) {
	got, err := parseLines(sampleLines())
	if err != nil {
		t.Fatalf("parseLines: %v", err)
	}

	if got.Program != "Elektrotechnik" {
		t.Errorf("Program = %q, want %q", got.Program, "Elektrotechnik")
	}
	if got.Grade != 2.0 {
		t.Errorf("Grade = %v, want 2.0", got.Grade)
	}
	if got.Credits != 30 || got.MaxCredits != 210 {
		t.Errorf("Credits/MaxCredits = %v/%v, want 30/210", got.Credits, got.MaxCredits)
	}

	// The programme row, both Modulbereich totals, every attempt row, the page
	// footers and the running header are all gone; three modules are left.
	want := []Module{
		{Name: "Höhere Mathematik", Grade: 1.3, Passed: true, Credits: 10, Semester: "23W"},
		// Failed at the first attempt, so the semester is the one that passed.
		{Name: "Schaltungstechnik", Grade: 2.0, Passed: true, Credits: 8, Semester: "24S"},
		// Passed without a grade, and its name wrapped onto a second line.
		{Name: "Laborpraktikum mit einem Namen, der umbricht", Grade: 0, Passed: true, Credits: 12, Semester: "25S"},
	}
	if len(got.Modules) != len(want) {
		t.Fatalf("got %d modules, want %d: %+v", len(got.Modules), len(want), got.Modules)
	}
	for i, w := range want {
		if got.Modules[i] != w {
			t.Errorf("module %d = %+v, want %+v", i, got.Modules[i], w)
		}
	}

	if sum := creditSum(got.Modules); sum != got.Credits {
		t.Errorf("module credits sum to %v, want the reported %v", sum, got.Credits)
	}
}

func TestParseLinesRejectsForeignDocuments(t *testing.T) {
	cases := map[string][]Line{
		"no Studiengang": fixture(1,
			"Module/Fächer|Note|Vm|Ang|CP|Datum|Sem",
			"Höhere Mathematik|1,3|N|10,00|01.03.2024",
		),
		"no grade table": fixture(1,
			"Studiengang:|(angestrebter) Abschluss:",
			"Elektrotechnik|Bachelor of Science RWTH Aachen University",
			"Gesamtnote: 2,0",
		),
	}

	for name, lines := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := parseLines(lines); !errors.Is(err, ErrNotNotenspiegel) {
				t.Fatalf("err = %v, want ErrNotNotenspiegel", err)
			}
		})
	}
}

// The transcript of a student who has not finished yet carries no Gesamtnote
// line, but the programme row still has the running totals.
func TestParseLinesFallsBackToTheProgrammeRow(t *testing.T) {
	got, err := parseLines(fixture(1,
		"Studiengang:|(angestrebter) Abschluss:",
		"Elektrotechnik|Bachelor of Science RWTH Aachen University",
		"Module/Fächer|Note|Vm|Ang|CP|Datum|Sem",
		"Elektrotechnik|2,3|N|10,00",
		"Höhere Mathematik|2,3|N|10,00|01.03.2024",
		"Höhere Mathematik I|2,3|BE|N|10,00|01.03.2024|23W",
	))
	if err != nil {
		t.Fatalf("parseLines: %v", err)
	}
	if got.Grade != 2.3 || got.Credits != 10 {
		t.Errorf("Grade/Credits = %v/%v, want 2.3/10", got.Grade, got.Credits)
	}
	if got.MaxCredits != 0 {
		t.Errorf("MaxCredits = %v, want 0 — it is only ever printed in the summary", got.MaxCredits)
	}
}

func TestParseRow(t *testing.T) {
	cases := []struct {
		name  string
		cells []string
		want  tableRow
		ok    bool
	}{{
		name:  "attempt",
		cells: []string{"Schaltungstechnik", "2,0", "BE", "N", "8,00", "01.08.2024", "24S"},
		want:  tableRow{name: "Schaltungstechnik", note: "2,0", vm: "BE", ang: "N", credits: "8,00", date: "01.08.2024", semester: "24S"},
		ok:    true,
	}, {
		// No Vermerk and no semester: the columns in between are simply absent,
		// so nothing can be read off a cell's position.
		name:  "roll-up",
		cells: []string{"Schaltungstechnik", "2,0", "N", "8,00", "01.08.2024"},
		want:  tableRow{name: "Schaltungstechnik", note: "2,0", ang: "N", credits: "8,00", date: "01.08.2024"},
		ok:    true,
	}, {
		name:  "heading with neither grade nor credits",
		cells: []string{"Medizin", "N", "28.08.2025"},
		want:  tableRow{name: "Medizin", ang: "N", date: "28.08.2025"},
		ok:    true,
	}, {
		name:  "ungraded pass",
		cells: []string{"Mentoring", "B", "BE", "N", "1,00", "02.04.2024", "23W"},
		want:  tableRow{name: "Mentoring", note: "B", vm: "BE", ang: "N", credits: "1,00", date: "02.04.2024", semester: "23W"},
		ok:    true,
	}, {
		// "N" is the Ang flag and never a Vermerk, so the two cannot be confused.
		name:  "credits over a thousand",
		cells: []string{"Programm", "1,0", "N", "1.024,00", "01.01.2025"},
		want:  tableRow{name: "Programm", note: "1,0", ang: "N", credits: "1.024,00", date: "01.01.2025"},
		ok:    true,
	}, {
		name:  "name split by a wide gap is folded back",
		cells: []string{"Formale Systeme,", "Automaten", "1,3", "N", "6,00", "21.08.2024"},
		want:  tableRow{name: "Formale Systeme, Automaten", note: "1,3", ang: "N", credits: "6,00", date: "21.08.2024"},
		ok:    true,
	}, {
		name:  "unreadable cell after a real column",
		cells: []string{"Programm", "1,0", "N", "6,00", "???"},
		ok:    false,
	}}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := parseRow(c.cells)
			if ok != c.ok {
				t.Fatalf("ok = %v, want %v", ok, c.ok)
			}
			if ok && got != c.want {
				t.Errorf("got %+v, want %+v", got, c.want)
			}
		})
	}
}

// run spells a string out one fragment per glyph, the way the PDF reader does.
// Runs it can measure advance in x; runs it cannot all share one origin. Every
// run ends in the replacement character the reader cannot decode.
func run(x, y, size float64, s string, measured bool) []fragment {
	frags := make([]fragment, 0, len(s)+1)
	for _, r := range s + "�" {
		frags = append(frags, fragment{x: x, y: y, size: size, s: string(r)})
		if measured {
			x += size / 2
		}
	}

	return frags
}

func TestGroupLines(t *testing.T) {
	var frags []fragment
	// Out of reading order and mixing both run shapes, as the document does.
	frags = append(frags, run(342.9, 469, 10, "1,7", true)...)
	frags = append(frags, run(59.8, 469, 10, "Programmierung", false)...)
	frags = append(frags, run(440.7, 469, 10, "8,00", true)...)
	frags = append(frags, run(411.4, 469, 10, "N", true)...)
	frags = append(frags, run(331.7, 566, 10, "Bachelor of Science", false)...)
	frags = append(frags, run(56.7, 566, 10, "Maschinenbau", true)...)
	frags = append(frags, run(59.8, 526.4, 10, "Module/Fächer", true)...)

	got := groupLines(3, frags)

	want := []Line{
		{Page: 3, Y: 566, Cells: []string{"Maschinenbau", "Bachelor of Science"}},
		{Page: 3, Y: 526, Cells: []string{"Module/Fächer"}},
		{Page: 3, Y: 469, Cells: []string{"Programmierung", "1,7", "N", "8,00"}},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d lines, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i].Page != want[i].Page || got[i].Y != want[i].Y {
			t.Errorf("line %d at page %d y %v, want page %d y %v", i, got[i].Page, got[i].Y, want[i].Page, want[i].Y)
		}
		if strings.Join(got[i].Cells, "|") != strings.Join(want[i].Cells, "|") {
			t.Errorf("line %d cells = %q, want %q", i, got[i].Cells, want[i].Cells)
		}
	}
}

func TestDecimal(t *testing.T) {
	cases := map[string]float64{
		"2,4":      2.4,
		"96,00":    96,
		"1.024,00": 1024,
		"B":        0,
		"":         0,
	}

	for in, want := range cases {
		if got := decimal(in); got != want {
			t.Errorf("decimal(%q) = %v, want %v", in, got, want)
		}
	}
}

func TestParseRejectsNonPDF(t *testing.T) {
	data := []byte("this is not a PDF, and reading it must not panic")
	if _, err := Parse(strings.NewReader(string(data)), int64(len(data))); !errors.Is(err, ErrNotNotenspiegel) {
		t.Fatalf("err = %v, want ErrNotNotenspiegel", err)
	}
}

// TestParseSample runs the whole pipeline over a real transcript. It needs the
// sample PDF, which is deliberately not in the repository; point sampleEnv at
// one to run it.
func TestParseSample(t *testing.T) {
	path := os.Getenv(sampleEnv)
	if path == "" {
		path = defaultSample
	}

	file, err := os.Open(path)
	if err != nil {
		t.Skipf("no sample transcript at %s (set %s): %v", path, sampleEnv, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		t.Fatalf("stat %s: %v", path, err)
	}

	got, err := Parse(file, info.Size())
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	// Everything here is an invariant rather than an expected value. The only
	// sample we have is a real student's record, and asserting their programme,
	// their Gesamtnote or their individual module marks would publish them in a
	// public repository. The structural checks below still fail loudly on every
	// parser bug the literal ones caught.

	if got.Program == "" {
		t.Error("Program is empty")
	}
	if got.Grade < 1.0 || got.Grade > 5.0 {
		t.Errorf("Grade = %v, want the German scale 1.0-5.0", got.Grade)
	}
	if got.Credits <= 0 || got.MaxCredits <= 0 || got.Credits > got.MaxCredits {
		t.Errorf("Credits/MaxCredits = %v/%v, want 0 < earned <= required", got.Credits, got.MaxCredits)
	}

	// The document is present twice, German then English. Parsing both halves
	// would roughly double this, and leaving the totals in inflates it further.
	if len(got.Modules) < 10 || float64(len(got.Modules)) > got.MaxCredits/4 {
		t.Errorf("got %d modules, implausible for a %v credit programme", len(got.Modules), got.MaxCredits)
	}

	// The real check on the aggregate-row heuristic: every credit the student
	// earned is counted once. A total left in double-counts a whole Modulbereich
	// and a module dropped loses its own.
	if sum := creditSum(got.Modules); math.Abs(sum-got.Credits) > 0.001 {
		t.Errorf("module credits sum to %v, want the reported %v", sum, got.Credits)
	}

	for _, m := range got.Modules {
		if strings.HasPrefix(m.Name, "Modulbereich") || m.Name == got.Program {
			t.Errorf("%q is a total, not a module", m.Name)
		}
		if m.Name == "" {
			t.Error("module with an empty name")
		}
		if m.Grade != 0 && (m.Grade < 1.0 || m.Grade > 5.0) {
			t.Errorf("module grade %v outside the German scale", m.Grade)
		}
	}
}

func creditSum(modules []Module) float64 {
	var sum float64
	for _, m := range modules {
		sum += m.Credits
	}

	return sum
}
