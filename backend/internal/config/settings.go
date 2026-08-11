// Package config applies deployment settings that would otherwise have to be
// clicked into the dashboard by hand.
package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// ApplyFromEnv points PocketBase at an SMTP server and names the app.
//
// PocketBase keeps these in the database, which makes a container's behaviour
// depend on whatever the last person saved in the dashboard. Reading them from
// the environment on every boot keeps the compose stack reproducible and lets it
// wire itself to Mailpit with no manual setup.
//
// Nothing happens unless SMTP_HOST is set, so a plain `serve` is unaffected.
//
//	SMTP_HOST      mail server hostname; enables the rest when set
//	SMTP_PORT      default 587
//	SMTP_USERNAME  optional
//	SMTP_PASSWORD  optional
//	SMTP_TLS       "true" to require TLS; otherwise StartTLS is offered
//	APP_NAME       shown in email subjects and the dashboard
//	APP_URL        base URL used in emailed links
//	SENDER_NAME    From: display name
//	SENDER_ADDRESS From: address
func ApplyFromEnv(app *pocketbase.PocketBase) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		// Settings aren't loaded until the default bootstrap has run.
		if err := e.Next(); err != nil {
			return err
		}

		host := os.Getenv("SMTP_HOST")
		if host == "" {
			return nil
		}

		port := 587
		if raw := os.Getenv("SMTP_PORT"); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil {
				return fmt.Errorf("invalid SMTP_PORT %q: %w", raw, err)
			}
			port = parsed
		}

		settings := e.App.Settings()
		settings.SMTP.Enabled = true
		settings.SMTP.Host = host
		settings.SMTP.Port = port
		settings.SMTP.Username = os.Getenv("SMTP_USERNAME")
		settings.SMTP.Password = os.Getenv("SMTP_PASSWORD")
		settings.SMTP.TLS = os.Getenv("SMTP_TLS") == "true"

		if name := os.Getenv("APP_NAME"); name != "" {
			settings.Meta.AppName = name
		}
		if url := os.Getenv("APP_URL"); url != "" {
			settings.Meta.AppURL = url
		}
		if name := os.Getenv("SENDER_NAME"); name != "" {
			settings.Meta.SenderName = name
		}
		if address := os.Getenv("SENDER_ADDRESS"); address != "" {
			settings.Meta.SenderAddress = address
		}

		if err := e.App.Save(settings); err != nil {
			return fmt.Errorf("failed to apply SMTP settings: %w", err)
		}

		e.App.Logger().Info("SMTP configured from environment", "host", host, "port", port)

		return nil
	})
}
