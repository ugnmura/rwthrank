package config

import (
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// ApplySecurity turns on the limits that make the public endpoints survivable.
//
// PocketBase ships the rate limiter switched off, which is fine for a local
// instance and not fine for this one. Three of the routes here are expensive in
// a way that is not obvious from the outside:
//
//   - request-otp sends real mail through a paid provider, and every unknown
//     address it is given becomes an account. Unlimited, it is a way to spend
//     someone else's sending reputation and fill the database at the same time.
//   - auth-with-otp is a guess at an eight digit code. PocketBase caps the
//     attempts against a single OTP, but nothing caps how many OTPs a caller
//     may ask for and then guess at.
//   - the transcript upload parses a PDF, which is the only CPU-heavy thing the
//     server does.
//
// Applied on boot rather than clicked into the dashboard, so a fresh container
// is never briefly unprotected and nobody has to remember.
func ApplySecurity(app *pocketbase.PocketBase) {
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}

		settings := e.App.Settings()
		settings.RateLimits.Enabled = true
		settings.RateLimits.Rules = rateLimitRules()

		// Behind a proxy every request arrives from the proxy, so a per-IP limit
		// would be one shared bucket for the whole internet. The header is only
		// trusted when it is named here, because anyone can send it: it is set
		// in the deployment, where there really is a proxy stripping it first.
		if header := strings.TrimSpace(os.Getenv("PROXY_IP_HEADER")); header != "" {
			settings.TrustedProxy.Headers = []string{header}
			// The rightmost address is the one the trusted proxy appended. The
			// leftmost is whatever the client claimed, which is a free pass.
			settings.TrustedProxy.UseLeftmostIP = false
		}

		if err := e.App.Save(settings); err != nil {
			return err
		}

		e.App.Logger().Info("rate limiting enabled", "rules", len(settings.RateLimits.Rules))

		return nil
	})
}

// rateLimitRules is the whole policy, in one place so it can be read at once.
//
// Costs are per client: PocketBase keys a rule on the authenticated record when
// there is one and on the IP otherwise.
func rateLimitRules() []core.RateLimitRule {
	return []core.RateLimitRule{
		// Mail costs money and reputation, and each new address is an account.
		// PocketBase allows one window per label, so this is a ten minute one:
		// long enough that a sustained caller cannot spend much sending, wide
		// enough that a mistyped address and a second go are not a lockout.
		{Label: "/api/collections/users/request-otp", Duration: 600, MaxRequests: 15},

		// Guessing a code. Slow enough that brute force is hopeless, loose
		// enough that mistyping one twice is not a lockout.
		{Label: "/api/collections/users/auth-with-otp", Duration: 60, MaxRequests: 10},

		// Parsing a PDF is the only expensive thing here.
		{Label: "/api/transcript", Duration: 60, MaxRequests: 10},

		// The read endpoints are cheap but not free, and they are the ones a
		// scraper would walk.
		{Label: "/api/compare", Duration: 60, MaxRequests: 120},
		{Label: "/api/rank", Duration: 60, MaxRequests: 120},

		// Everything else, including the collection APIs.
		{Label: "*:auth", Duration: 60, MaxRequests: 30},
		{Label: "*:create", Duration: 60, MaxRequests: 60},
		{Label: "/api/", Duration: 10, MaxRequests: 200},
	}
}
