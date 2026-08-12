package transcript

import (
	"os"
	"testing"
)

// Every class should come back with both names, since the document prints the
// whole table twice.
func TestParseSampleEnglishNames(t *testing.T) {
	path := os.Getenv(sampleEnv)
	if path == "" {
		path = defaultSample
	}

	file, err := os.Open(path)
	if err != nil {
		t.Skipf("no sample transcript at %s: %v", path, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		t.Fatalf("stat: %v", err)
	}

	got, err := Parse(file, info.Size())
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	missing := 0
	same := 0
	for _, m := range got.Modules {
		if m.NameEn == "" {
			missing++
			continue
		}
		// A few genuinely match across languages, but most should not.
		if m.NameEn == m.Name {
			same++
		}
	}

	if missing > 0 {
		t.Errorf("%d of %d modules have no English name", missing, len(got.Modules))
	}
	if same == len(got.Modules) {
		t.Error("every English name equals the German one; the halves were not paired")
	}
}
