package transcript

import (
	"fmt"
	"io"

	"github.com/ledongthuc/pdf"
)

// pdfExtractor reads positioned text with github.com/ledongthuc/pdf.
//
// It is the only permissively licensed pure-Go reader that can open this
// document at all: dslipak/pdf panics on it, pdfcpu has no text extraction and
// hands back raw content streams, go-fitz and go-pdfium need cgo (the whole
// deployment is one static binary), and unipdf is AGPL and checks a license key
// over the network per document.
//
// Its text layer is not trustworthy on its own — it emits one fragment per
// glyph, reports no widths, and mis-decodes the column separator as U+FFFD —
// which is why groupLines rebuilds the lines from coordinates instead.
type pdfExtractor struct{}

func (pdfExtractor) Lines(r io.ReaderAt, size int64) (lines []Line, err error) {
	// The reader indexes into the objects it reads before validating them, so a
	// truncated or hostile file crashes the goroutine rather than returning an
	// error. These files arrive from the internet; a bad one must not take the
	// server down with it.
	defer func() {
		if rec := recover(); rec != nil {
			lines, err = nil, fmt.Errorf("%w: unreadable PDF (%v)", ErrNotNotenspiegel, rec)
		}
	}()

	reader, err := pdf.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrNotNotenspiegel, err)
	}

	for number := 1; number <= reader.NumPage(); number++ {
		page := reader.Page(number)
		if page.V.IsNull() {
			continue
		}

		texts := page.Content().Text
		frags := make([]fragment, 0, len(texts))
		for _, t := range texts {
			frags = append(frags, fragment{x: t.X, y: t.Y, size: t.FontSize, s: t.S})
		}

		lines = append(lines, groupLines(number, frags)...)
	}

	return lines, nil
}
