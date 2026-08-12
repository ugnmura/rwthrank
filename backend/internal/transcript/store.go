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
func Store(app core.App, userID string, parsed *Transcript, pdf []byte, filename string) (string, error) {
	var transcriptID string

	err := app.RunInTransaction(func(tx core.App) error {
		transcripts, err := tx.FindCollectionByNameOrId(transcriptsCollection)
		if err != nil {
			return err
		}

		record := core.NewRecord(transcripts)
		record.Set("user", userID)
		record.Set("program", parsed.Program)
		record.Set("degree", parsed.Degree)
		record.Set("grade", parsed.Grade)
		record.Set("credits", parsed.Credits)
		record.Set("maxCredits", parsed.MaxCredits)

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
			row.Set("grade", module.Grade)
			row.Set("passed", module.Passed)
			row.Set("credits", module.Credits)
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
