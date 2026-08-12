package transcript

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

const (
	// uploadPath takes a Notenspiegel and answers with its numbers.
	//
	//	POST /api/transcript   multipart/form-data, field "file"
	//	-> {"program":"Maschinenbau","degree":"Bachelor","grade":2.3,"credits":96,"maxCredits":180,"moduleCount":17}
	uploadPath = "/api/transcript"

	// fileField is the multipart field the PDF arrives in.
	fileField = "file"

	// maxUpload bounds both the request and the memory one costs. A Notenspiegel
	// is well under 100 KB.
	maxUpload = 10 << 20
)

// uploadResult is the response body. Field names are part of the API the
// frontend is written against; do not rename them.
type uploadResult struct {
	Program     string  `json:"program"`
	Degree      string  `json:"degree"`
	Grade       float64 `json:"grade"`
	Credits     float64 `json:"credits"`
	MaxCredits  float64 `json:"maxCredits"`
	ModuleCount int     `json:"moduleCount"`
}

// RegisterRoutes installs the transcript upload endpoint.
func RegisterRoutes(app *pocketbase.PocketBase) {
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		e.Router.POST(uploadPath, handleUpload).Bind(apis.RequireAuth())

		return e.Next()
	})
}

// handleUpload parses an uploaded Notenspiegel and returns its numbers.
//
// The PDF is never written anywhere. It is read into memory, parsed, and
// dropped when the request ends: someone else's full transcript — name, date of
// birth, Matrikelnummer, every attempt they ever failed — is a liability worth
// nothing to us, and the handful of numbers below is all the app needs.
func handleUpload(e *core.RequestEvent) error {
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, maxUpload)

	// maxMemory is the whole cap, so the upload is never spooled to a temp file.
	if err := e.Request.ParseMultipartForm(maxUpload); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return e.BadRequestError(fmt.Sprintf("The file is larger than the %d MB limit.", maxUpload>>20), err)
		}

		return e.BadRequestError(fmt.Sprintf("Expected a multipart form with a %q field.", fileField), err)
	}
	defer e.Request.MultipartForm.RemoveAll()

	file, _, err := e.Request.FormFile(fileField)
	if err != nil {
		return e.BadRequestError(fmt.Sprintf("Missing the %q upload.", fileField), err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return e.BadRequestError("Could not read the upload.", err)
	}

	// Content-Type comes from the browser and means nothing; the header does.
	if !bytes.HasPrefix(data, []byte("%PDF-")) {
		return e.BadRequestError("Only PDF files are accepted.", nil)
	}

	parsed, err := Parse(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		if errors.Is(err, ErrNotNotenspiegel) {
			return e.BadRequestError("This PDF is not an RWTH Notenspiegel.", err)
		}

		return e.InternalServerError("Failed to read the transcript.", err)
	}

	return e.JSON(http.StatusOK, uploadResult{
		Program:     parsed.Program,
		Degree:      parsed.Degree,
		Grade:       parsed.Grade,
		Credits:     parsed.Credits,
		MaxCredits:  parsed.MaxCredits,
		ModuleCount: len(parsed.Modules),
	})
}
