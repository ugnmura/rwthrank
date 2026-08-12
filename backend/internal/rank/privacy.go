package rank

// An average over one person is that person's grade.
//
// Every comparison here can be narrowed — one class, one semester, one
// programme — and narrowed far enough the group holding the "cohort average"
// is a single student. Anyone who knows who else sat a small seminar could
// then read their mark straight off the page, exactly, without ever being told
// a name. The rank is a weaker statement (better or worse than me) and stays;
// the figure that spells the grade out does not.
//
// Two is the smallest group where the average is not simply somebody's grade.
// It is a low bar on purpose: a threshold high enough to be comfortable would
// leave the site blank for its first term, and a site that shows nothing is one
// nobody uploads to.
const minOthers = 2

// othersIn is the size of a group not counting the person asking about it.
func othersIn(total int64, callerCounted bool) int64 {
	if callerCounted && total > 0 {
		return total - 1
	}

	return total
}

// mayReveal reports whether an average over this group describes more than one
// person, and so can be shown without spelling out a grade that is not yours.
func mayReveal(total int64, callerCounted bool) bool {
	return othersIn(total, callerCounted) >= minOthers
}
