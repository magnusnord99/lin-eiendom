# Codex review log — Dokumenter (document storage) plan

Reviewer: Codex (gpt-6-astra, effort: high), via claudex-loop.
Plan: `docs/superpowers/plans/2026-10-27-dokumenter.md`
Final approved SHA256: `79ccbd87ffec6cec23d5ff104d368f6ea0d59d013162a642c7e7375909c6f12a`

## Round 1 — REVISE (4 findings)

- **DOC-001 (medium):** Task 2 uploads the Blob before inserting metadata, with no compensating cleanup if the insert fails. A concrete race exists with `app/api/boliger/[id]/route.ts`'s `DELETE`: a property can be deleted after the upload route's existence check but before `Dokument` creation, failing the FK insert and leaving an orphaned, unreachable Blob object.
- **DOC-002 (medium):** The planned `GET` route interpolated the stored `navn` directly into `Content-Disposition`. A valid filename containing an en dash (or other non-ASCII byte, or a quote) violates the `Headers`/`Response` API's ByteString requirement for raw header values — constructing the response can throw instead of downloading.
- **DOC-003 (medium):** The plan's own Goal line promised listing *and filtering* documents per property, but Task 3 only specified an unfiltered list — no filter UI was actually planned.
- **DOC-004 (low):** The new required `Dokument` → `Bolig` relation isn't accounted for in the existing `DELETE /api/boliger/[id]` handler, which only fast-path-checks delprosjekter/kapitalinnskudd/utgifter and names only those three in its P2003 fallback message. A property whose only dependent rows are documents would get an unhandled error or a misleading message.

**Disposition:** All four accepted.
- DOC-001: added a compensating `del(blobPathname)` call (own try/catch, logged on failure) around the metadata-insert failure path in the upload route, plus test coverage for both the insert-fails/cleanup-succeeds and insert-fails/cleanup-also-fails cases.
- DOC-002: replaced the bare `filename="..."` header with the standard two-part form (`filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>`), stripping control characters first; added test coverage for an en dash, a double quote, and a control character in the stored name.
- DOC-003: added a `harDokumenter`-shaped pair of client-side filters (category + delprosjekt) to the Dokumenter panel's list, combined with AND; updated the Goal line to explicitly say "by category and by delprosjekt."
- DOC-004: added `harDokumenter` to `lib/dokument.ts` (Task 1), wired it into the existing `DELETE /api/boliger/[id]` handler as a fourth fast-path check with its own 409 message, and extended the P2003 fallback message to also name documents; added test coverage.

## Round 2 — REVISE (2 findings)

- **DOC-005 (low):** The round-1 fix for DOC-002 used `encodeURIComponent` alone for the RFC 5987 `filename*` value, which leaves `'`, `(`, `)`, and `*` unescaped — confirmed against this project's own installed `next/dist/compiled/content-disposition` parser, which rejects those raw characters in an extended value. A name like `"Kontrakt – signert (1).pdf"` would still produce an invalid header.
- **DOC-006 (medium):** Two test-scaffolding gaps: (1) the `POST /api/dokumenter` test plan never mocked `prisma.bolig.findUnique`, even though the route's own Step 4 instructions require that lookup before uploading — every test past that point would hit an undefined mock; the next-auth mock line also had a brace-matching typo. (2) Task 2's new `DELETE /api/boliger/[id]` test instructions assumed `harDelprosjekter`/`harKapitalinnskudd`/`harUtgifter` are mocked as functions, but the actual existing test file mocks the underlying `prisma.*.count` calls directly and runs the real `har*` functions against those mocks — `harDokumenter`'s test needs to follow that same convention, not a function-level mock, and the pre-existing P2003-race test needs `prismaMock.dokument.count` explicitly stubbed too or it reaches the new fast-path check with an undefined mock return.

**Disposition:** Both accepted.
- DOC-005: added a second encoding pass after `encodeURIComponent` that percent-encodes `'`, `(`, `)`, `*` specifically, and a test requiring a name with both non-ASCII and `'()*` characters to produce a header that doesn't get rejected by a real parser.
- DOC-006: added `bolig.findUnique` to the upload route's mocked Prisma client (with explicit existing/missing-property test cases), fixed the brace typo, and rewrote the `DELETE /api/boliger/[id]` test steps to mock `prismaMock.dokument.count` directly (matching the file's actual existing convention for the other three dependency checks) instead of a `harDokumenter` function mock, including explicitly zeroing it in the pre-existing P2003-race test.

## Round 3 — APPROVED

No further findings. Plan SHA256 `79ccbd87ffec6cec23d5ff104d368f6ea0d59d013162a642c7e7375909c6f12a` approved for implementation.
