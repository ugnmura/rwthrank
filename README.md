# rwthrank

**The ranking that tells you whether to keep doing the thing you hate.**

Every RWTH student knows their Gesamtnote and nobody knows what it is worth. A
2,3 in Maschinenbau is a different life from a 2,3 in BWL, and the number on the
Notenspiegel says nothing about which one you are living. The people who could
tell you are the ones you would never ask.

So rwthrank asks the transcripts instead. Upload the PDF the Campus Office gives
you, and the site puts your grade next to everyone else's who uploaded theirs:
your place in your own programme, the average and the median around you, and the
same figures per class, per semester, or over exactly the modules you pick. If
the answer is that you are in the top five per cent of a subject you cannot
stand, that is worth knowing. If it is that everyone else is finding it just as
hard, that is worth knowing too.

Live at [rwthrank.mindevice.net](https://rwthrank.mindevice.net).

## What it does

**Sign in with an email, nothing else.** No password exists anywhere in the
flow. You get a code, the code becomes a session, and an unknown address becomes
an account the first time it verifies one. There is no password to leak because
there is no password.

**Read the Notenspiegel rather than a form.** The PDF is parsed in Go, module by
module: name, credits, grade, semester, in German and English. Nobody types
twenty rows into a website, and nobody types them honestly.

**Compare what you actually want compared.** The overall grade is the printed
Gesamtnote, because that is the number on your document and a recomputed one
would contradict it. Narrow it to a class, a semester, a handful of modules, and
the site computes from there — everyone in the comparison measured by the same
filter, always credit-weighted, average and median side by side. A semester you
have not sat yet still answers: it shows what the people who did sit it scored.

**Keep more than one transcript.** A Bachelor and a Master are different
documents, and re-uploading a year later is another. The document is what holds
a programme, a degree and a grade; the account itself holds an email address and
almost nothing else.

## What it does not do

A Notenspiegel carries a name, a date of birth, a Matrikelnummer and every exam
anyone ever failed. It is the most sensitive thing here by a distance, so:

- The stored PDF is protected — not reachable at a guessable URL, and it needs a
  file token even for an administrator.
- Transcripts and results are readable only by the person they belong to. There
  are no create, update or delete rules on them at all; every write happens
  server-side while parsing.
- Deleting an account takes its transcripts and their rows with it. Deleting one
  transcript takes its rows. Only the course names survive, because a module
  name is shared vocabulary rather than anyone's data.
- Nothing is ranked against you by name. A comparison returns counts and grades,
  never who.
- Account recovery is inbox access. With no password there is no other path in,
  which is the trade the design makes on purpose.

## How it is built

```
backend/    PocketBase used as a Go framework: auth, database, PDF parsing, the
            ranking endpoints. One binary, one SQLite file.
frontend/   Next.js exported as static files, React Query, daisyUI. German by
            default, English available, grades formatted per locale.
deploy/     The compose stack that runs on the server.
```

The backend runs on a small Hetzner box behind Traefik and updates itself from
the image CI pushes. The frontend is static and served from GitHub Pages. There
is no server rendering, no session cookie, and no third party in the middle of
either.

Running it, working on one piece at a time, and everything operational lives in
[AGENTS.md](AGENTS.md).

## Licence

Not yet decided. Ask before reusing it.
