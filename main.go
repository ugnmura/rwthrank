package main

import (
	"log"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/ugnmura/rwthrank/internal/auth"
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

	auth.RegisterOTP(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
