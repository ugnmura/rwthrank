package main

import (
	"log"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/ugnmura/rwthrank/internal/auth"
	"github.com/ugnmura/rwthrank/internal/config"
	"github.com/ugnmura/rwthrank/internal/rank"
	"github.com/ugnmura/rwthrank/internal/transcript"
	_ "github.com/ugnmura/rwthrank/migrations"
)

func main() {
	app := pocketbase.New()

	// Automigrate only under "go run", so dashboard edits during development are
	// written out as migration files instead of living only in pb_data.
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	// Runs the same sweep the hourly job does, so it can be checked or forced
	// by hand: `rwthrank prune`.
	app.RootCmd.AddCommand(&cobra.Command{
		Use:   "prune",
		Short: "Delete accounts that never confirmed their email address",
		Run: func(_ *cobra.Command, _ []string) {
			if err := app.Bootstrap(); err != nil {
				log.Fatal(err)
			}
			removed, err := auth.PruneNow(app)
			if err != nil {
				log.Fatal(err)
			}
			log.Printf("pruned %d unconfirmed account(s)", removed)
		},
	})

	config.ApplyFromEnv(app)
	config.ApplySecurity(app)
	auth.RegisterOTP(app)
	auth.RegisterPrune(app)
	rank.RegisterRoutes(app)
	transcript.RegisterRoutes(app)
	transcript.RegisterCleanup(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
