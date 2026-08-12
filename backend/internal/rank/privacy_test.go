package rank

import "testing"

func TestOthersIn(t *testing.T) {
	cases := []struct {
		name     string
		total    int64
		included bool
		want     int64
	}{
		{"an empty group has nobody in it", 0, false, 0},
		{"a group the caller is not in is all others", 5, false, 5},
		{"a group the caller is in is one fewer", 5, true, 4},
		{"a group of just the caller is nobody else", 1, true, 0},
		{"an empty group does not go negative", 0, true, 0},
	}

	for _, c := range cases {
		if got := othersIn(c.total, c.included); got != c.want {
			t.Errorf("%s: othersIn(%d, %v) = %d, want %d", c.name, c.total, c.included, got, c.want)
		}
	}
}

func TestMayReveal(t *testing.T) {
	// The case this exists for: a class of two, one of them the caller. The
	// average is the other person's grade to two decimal places.
	if mayReveal(2, true) {
		t.Error("an average over a single other person was allowed out")
	}

	// And the same shape without the caller in it at all.
	if mayReveal(1, false) {
		t.Error("an average over one person was allowed out")
	}

	if mayReveal(0, false) || mayReveal(1, true) {
		t.Error("an average over nobody was allowed out")
	}

	if !mayReveal(3, true) {
		t.Error("a class of three was withheld; two others is enough to average")
	}

	if !mayReveal(2, false) {
		t.Error("two people the caller is not among was withheld")
	}

	if !mayReveal(240, true) {
		t.Error("a whole programme was withheld")
	}
}

func TestMinOthersIsNotAccidentallyZero(t *testing.T) {
	// A threshold of zero or one silently reintroduces the leak while leaving
	// every call site looking correct.
	if minOthers < 2 {
		t.Fatalf("minOthers = %d, which allows an average over one person", minOthers)
	}
}
