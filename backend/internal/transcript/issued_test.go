package transcript

import (
	"os"
	"testing"
)

// The print date is what orders two documents, so it has to survive parsing.
func TestParseSampleIssued(t *testing.T) {
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

	// Not the literal date: that is the student's, and this file is public.
	if len(got.Issued) != len("2006-01-02") {
		t.Errorf("Issued = %q, want an ISO date", got.Issued)
	}
	if got.Issued[4] != '-' || got.Issued[7] != '-' {
		t.Errorf("Issued = %q, want YYYY-MM-DD so string order is date order", got.Issued)
	}
}
