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
	//	-> {"id":"...","program":"Maschinenbau","degree":"Bachelor","grade":2.3,"credits":96,"maxCredits":180,"moduleCount":17}
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
	ID          string  `json:"id"`
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
		registerGradeRoute(e)
		registerSubjectRoute(e)

		return e.Next()
	})
}

// handleUpload parses an uploaded Notenspiegel, stores it, and answers with its
// numbers.
//
// The document is kept, along with a row per module, because per-course ranking
// needs the modules and re-parsing is the only way to recover them otherwise.
// That makes this the most sensitive thing the app holds: a Notenspiegel carries
// a name, a date of birth, a Matrikelnummer and every attempt the student ever
// failed. The file field is protected and both collections are owner-read only.
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

	file, header, err := e.Request.FormFile(fileField)
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

	confirmed := e.Request.URL.Query().Get("replace") == "1"

	id, err := Store(e.App, e.Auth.Id, parsed, data, header.Filename, confirmed)
	if err != nil {
		if errors.Is(err, ErrOlderTranscript) {
			return e.BadRequestError("You already have a newer transcript for this subject.", err)
		}
		// 409: the upload is fine, it just collides with something stored. The
		// body says what, so the caller can ask about the right one.
		if errors.Is(err, ErrWouldReplace) {
			return e.JSON(http.StatusConflict, map[string]any{
				"status":  http.StatusConflict,
				"message": "This would replace a stored transcript.",
				"replaces": map[string]string{
					"program": parsed.Program,
					"degree":  parsed.Degree,
				},
			})
		}

		return e.InternalServerError("Failed to store the transcript.", err)
	}

	return e.JSON(http.StatusOK, uploadResult{
		ID:          id,
		Program:     parsed.Program,
		Degree:      parsed.Degree,
		Grade:       parsed.Grade,
		Credits:     parsed.Credits,
		MaxCredits:  parsed.MaxCredits,
		ModuleCount: len(parsed.Modules),
	})
}
