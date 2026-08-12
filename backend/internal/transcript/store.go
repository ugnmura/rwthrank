package transcript

import (
	"fmt"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

const (
	transcriptsCollection = "transcripts"
	resultsCollection     = "results"
	coursesCollection     = "courses"
)

// Store writes one upload: the document, and a row per module on it.
//
// Everything happens in a transaction. A half-written transcript — the summary
// saved but its modules missing — would read as a complete one and quietly skew
// every per-course ranking it touched.
func Store(app core.App, userID string, parsed *Transcript, pdf []byte, filename string, confirmed bool) (string, error) {
	var transcriptID string

	err := app.RunInTransaction(func(tx core.App) error {
		transcripts, err := tx.FindCollectionByNameOrId(transcriptsCollection)
		if err != nil {
			return err
		}

		// One transcript per subject: a newer document for the same programme
		// and degree replaces the old one rather than sitting beside it, so a
		// person's standing in a subject has a single answer.
		previous, err := sameSubject(tx, userID, parsed.Program, parsed.Degree)
		if err != nil {
			return err
		}
		if previous != nil {
			// Only forward. A PDF exported last year can be uploaded today, and
			// accepting it would roll the student's results back.
			if older := previous.GetString("issued"); older != "" && parsed.Issued != "" && parsed.Issued < older {
				return ErrOlderTranscript
			}

			// Whether anything is replaced depends on what the document turned
			// out to be, which is only known here. Asking before the upload
			// would mean asking on every upload, including the ones that
			// replace nothing.
			if !confirmed {
				return ErrWouldReplace
			}

			if err := tx.Delete(previous); err != nil {
				return err
			}
		}

		record := core.NewRecord(transcripts)
		record.Set("user", userID)
		record.Set("issued", parsed.Issued)
		record.Set("program", parsed.Program)
		record.Set("degree", parsed.Degree)
		// Left unset rather than zeroed when the document does not say. Zero is
		// not a grade at all, and zero credits is a real answer that must stay
		// distinguishable from an absent one.
		setNumber(record, "grade", parsed.Grade)
		setNumber(record, "credits", parsed.Credits)
		setNumber(record, "maxCredits", parsed.MaxCredits)

		if len(pdf) > 0 {
			file, err := filesystem.NewFileFromBytes(pdf, filename)
			if err != nil {
				return fmt.Errorf("failed to wrap the upload: %w", err)
			}
			record.Set("pdf", file)
		}

		if err := tx.Save(record); err != nil {
			return err
		}
		transcriptID = record.Id

		results, err := tx.FindCollectionByNameOrId(resultsCollection)
		if err != nil {
			return err
		}

		for _, module := range parsed.Modules {
			courseID, err := courseID(tx, module.Name)
			if err != nil {
				return err
			}

			row := core.NewRecord(results)
			row.Set("transcript", record.Id)
			row.Set("course", courseID)
			row.Set("user", userID)
			// A module passed without a grade — the German "B" — has no number
			// to record, so the column stays NULL instead of claiming a 0.
			setNumber(row, "grade", module.Grade)
			row.Set("passed", module.Passed)
			setNumber(row, "credits", module.Credits)
			row.Set("semester", module.Semester)

			if err := tx.Save(row); err != nil {
				return fmt.Errorf("failed to store %q: %w", module.Name, err)
			}
		}

		return nil
	})

	return transcriptID, err
}

// courseID finds the course by name or creates it.
//
// Courses are shared: two people who both sat Datenstrukturen point at the same
// row, which is what makes ranking within one class a lookup rather than a
// string comparison across the table. The unique index on the name is what
// keeps that true under concurrent uploads.
func courseID(tx core.App, name string) (string, error) {
	existing, err := tx.FindFirstRecordByFilter(
		coursesCollection,
		"name = {:name}",
		dbx.Params{"name": name},
	)
	if err == nil {
		return existing.Id, nil
	}

	courses, err := tx.FindCollectionByNameOrId(coursesCollection)
	if err != nil {
		return "", err
	}

	course := core.NewRecord(courses)
	course.Set("name", name)
	if err := tx.Save(course); err != nil {
		return "", fmt.Errorf("failed to create course %q: %w", name, err)
	}

	return course.Id, nil
}

// sameSubject finds the transcript this upload would replace: the one already
// stored for the same programme and degree. A document with no subject named
// cannot collide with anything, so it never replaces.
func sameSubject(tx core.App, userID, program, degree string) (*core.Record, error) {
	if program == "" || degree == "" {
		return nil, nil
	}

	found, err := tx.FindRecordsByFilter(
		transcriptsCollection,
		"user = {:user} && program = {:program} && degree = {:degree}",
		"-uploaded",
		1,
		0,
		dbx.Params{"user": userID, "program": program, "degree": degree},
	)
	if err != nil || len(found) == 0 {
		return nil, err
	}

	return found[0], nil
}

// setNumber writes a number only when the document actually stated one.
func setNumber(record *core.Record, field string, value float64) {
	if value <= 0 {
		return
	}

	record.Set(field, value)
}
