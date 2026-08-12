package auth

import (
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// unconfirmedGrace is how long an account has to confirm its address.
//
// Comfortably longer than the five minutes an OTP lasts, so someone who opens
// the mail the next morning can still ask for a new link against the same
// record rather than being told nothing happened.
const unconfirmedGrace = 24 * time.Hour

// RegisterPrune deletes accounts that were never confirmed.
//
// The record has to exist before the email goes out, because the OTP is issued
// against it. That means asking for a link is enough to create an account, and
// anyone can ask on behalf of an address that is not theirs. Without this, a
// stranger's email address would sit in the database indefinitely on the
// strength of a request they never made and never answered.
//
// Only unverified accounts go: verified is set the moment a link is used, so
// anything still unverified after the grace period was never confirmed by
// whoever owns that inbox.
func RegisterPrune(app *pocketbase.PocketBase) {
	app.Cron().MustAdd("prune-unconfirmed", "0 * * * *", func() {
		cutoff := time.Now().Add(-unconfirmedGrace).UTC().Format("2006-01-02 15:04:05Z")

		stale, err := app.FindRecordsByFilter(
			usersCollection,
			"verified = false && created < {:cutoff}",
			"",
			0,
			0,
			dbx.Params{"cutoff": cutoff},
		)
		if err != nil {
			app.Logger().Error("Failed to look for unconfirmed accounts", "error", err)
			return
		}
		if len(stale) == 0 {
			return
		}

		removed := 0
		for _, record := range stale {
			// Cascades take any transcripts with it, though an account that
			// never confirmed should not have any.
			if err := app.Delete(record); err != nil {
				app.Logger().Error("Failed to delete an unconfirmed account", "error", err, "recordId", record.Id)
				continue
			}
			removed++
		}

		app.Logger().Info("Pruned unconfirmed accounts", "count", removed)
	})
}

// PruneNow runs the same sweep immediately. Used by tests and by hand.
func PruneNow(app core.App) (int, error) {
	cutoff := time.Now().Add(-unconfirmedGrace).UTC().Format("2006-01-02 15:04:05Z")

	stale, err := app.FindRecordsByFilter(
		usersCollection,
		"verified = false && created < {:cutoff}",
		"",
		0,
		0,
		dbx.Params{"cutoff": cutoff},
	)
	if err != nil {
		return 0, err
	}

	removed := 0
	for _, record := range stale {
		if err := app.Delete(record); err != nil {
			return removed, err
		}
		removed++
	}

	return removed, nil
}
