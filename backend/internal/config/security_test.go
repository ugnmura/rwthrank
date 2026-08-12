package config

import (
	"strings"
	"testing"
)

func TestRateLimitRulesCoverTheExpensiveRoutes(t *testing.T) {
	rules := rateLimitRules()

	// Each of these costs something a caller does not pay for: mail through a
	// paid provider, a guess at a code, or a PDF parse on a small box.
	for _, path := range []string{
		"/api/collections/users/request-otp",
		"/api/collections/users/auth-with-otp",
		"/api/transcript",
	} {
		found := false
		for _, rule := range rules {
			if rule.Label == path {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("%s has no rate limit", path)
		}
	}
}

func TestRateLimitRulesAreCatchAllLast(t *testing.T) {
	// PocketBase matches the most specific label, but a catch-all that is
	// tighter than a specific rule would still cap it. "/api/" is the floor
	// everything else sits above.
	rules := rateLimitRules()

	var catchAll, perMinute int
	for _, rule := range rules {
		if rule.Label == "/api/" {
			catchAll = int(rule.MaxRequests) * (60 / int(rule.Duration))
		}
		if rule.Label == "/api/compare" && rule.Duration == 60 {
			perMinute = int(rule.MaxRequests)
		}
	}

	if catchAll == 0 {
		t.Fatal("there is no catch-all rule, so an unnamed route is unlimited")
	}
	if perMinute > catchAll {
		t.Errorf("compare allows %d/min but the catch-all caps at %d/min", perMinute, catchAll)
	}
}

func TestMailIsRatedOverAWindowLongEnoughToMatter(t *testing.T) {
	// Ten a minute is still six hundred an hour, which is a lot of somebody
	// else's sending reputation. PocketBase allows one window per label, so the
	// window itself has to be the long one.
	for _, rule := range rateLimitRules() {
		if rule.Label != "/api/collections/users/request-otp" {
			continue
		}

		if rule.Duration < 300 {
			t.Errorf("the mail window is %ds, short enough to sustain a flood", rule.Duration)
		}
		perHour := float64(rule.MaxRequests) * 3600 / float64(rule.Duration)
		if perHour > 120 {
			t.Errorf("request-otp allows %.0f emails an hour per caller", perHour)
		}
	}
}

func TestNoLabelIsConfiguredTwice(t *testing.T) {
	// PocketBase refuses to boot on a duplicate label, and the failure is a
	// line in the log rather than anything the site shows.
	seen := map[string]bool{}
	for _, rule := range rateLimitRules() {
		if seen[rule.Label] {
			t.Fatalf("%s is configured twice; the server will refuse to start", rule.Label)
		}
		seen[rule.Label] = true
	}
}

func TestEveryRuleActuallyLimitsSomething(t *testing.T) {
	for _, rule := range rateLimitRules() {
		if rule.MaxRequests <= 0 {
			t.Errorf("%s allows %d requests, which blocks the route outright", rule.Label, rule.MaxRequests)
		}
		if rule.Duration <= 0 {
			t.Errorf("%s has a window of %d seconds", rule.Label, rule.Duration)
		}
		if strings.TrimSpace(rule.Label) == "" {
			t.Error("a rule with no label matches nothing")
		}
	}
}
