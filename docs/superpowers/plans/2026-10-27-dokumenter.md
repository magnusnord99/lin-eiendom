# Dokumenter (document storage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any admin upload a file (contract, invoice, receipt, image, drawing, or other) tied to a Bolig and optionally also to one of its Delprosjekt rows, list and filter those files per eiendom (by category and by delprosjekt), download/view them, and delete them — replacing the current "nowhere, it lives in Messenger/email" state with real, categorized storage per the spec (§7.7).

**Architecture:** A new `Dokument` Prisma model holds only metadata (`eiendomId`, optional `delprosjektId`, `kategori`, `navn`, `blobPathname`, `mimeType`, `storrelse`, `opplastetAvBrukerId`, `opprettet`) — the file bytes themselves live in a new **private** Vercel Blob store, not in SQLite/libsql and not on the local filesystem. This is a deliberate departure from this codebase's two existing upload patterns (`app/api/upload/route.ts` writes to the local `public/uploads/` filesystem for Bolig images; `lib/utgift.ts`'s `lagreKvittering` stores receipt bytes directly as a `Bytes` column) — neither scales to a real external store, and the spec's own §9 explicitly calls for "ekstern filtjeneste (sannsynligvis Vercel Blob)" for this feature specifically. `lib/dokument.ts` stays storage-agnostic: it only reads/writes the `Dokument` table (so its tests run against `createTestDb()`'s real SQLite exactly like every other `lib/*.ts` module, no network or Blob calls in unit tests). All actual Blob I/O (`put`/`get`/`del` from the `@vercel/blob` SDK) lives in the three new `app/api/dokumenter/...` route handlers, which call `lib/dokument.ts` for the metadata half of each operation. The upload flow is a single authenticated `POST` with a `multipart/form-data` body (file + metadata together in one request) — not Vercel's client-upload/token-exchange flow — see Global Constraints for why.

**Tech Stack:** Next.js 16 App Router Route Handlers, Prisma 7 (libsql/SQLite) for metadata only, `@vercel/blob` (new dependency) for file bytes, a new **private** Vercel Blob store (provisioned once, manually, outside this plan — see Task 2's Step 0), Vitest with `createTestDb()` for `lib/dokument.ts`, and `vi.mock("@vercel/blob", ...)` for the route-handler tests (first time this codebase mocks an external SDK rather than `@/lib/prisma` or `next-auth`).

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` §7.7 (Dokumenter): "Opplasting knyttet til eiendom og/eller delprosjekt, med kategori (kontrakt, faktura, kvittering, bilde, tegning, annet)." §9 defers the storage choice to implementation time ("velges endelig via Vercel Marketplace-oppsett når implementasjonen starter, ikke låst i dette dokumentet") — this plan makes that call (Vercel Blob, private access) and records why below.

## Global Constraints

- **Why a private Blob store, not public:** these documents include `faktura`/`kontrakt`/`kvittering` — financial and legal documents about a specific property's finances, the same class of information `kjopesum`/`salgssum`/`finansiering` already guard as internal-only on `Bolig`. A public Blob URL is a bare, guessable-if-leaked link with no auth check; a private store requires every read to go through this app's own `get(pathname, { access: "private" })` call, which only ever happens inside the authenticated `GET /api/dokumenter/[id]` route built in Task 2. Never pass `access: "public"` anywhere in this plan's code.
- **Why a single server-side `POST` with a FormData body, not Vercel's client-upload (token-exchange) flow:** Vercel Functions cap request/response bodies at 4.5 MB, which the client-upload flow exists specifically to route around for larger files. Two things make that flow the wrong fit here instead: (1) its `onUploadCompleted` webhook — the step that would normally write the `Dokument` row after a successful upload — requires Vercel Blob to reach back out to a public callback URL, which does **not** work against `localhost` without a tunneling tool (e.g. ngrok) that this project does not use, breaking local development and this plan's own manual-verification step; (2) it is meaningfully more moving parts (a token-generation route, a client-side `upload()` call, an async completion callback racing the UI) for a 4-person internal tool where capping the upload size is a perfectly acceptable trade. This plan therefore caps uploads at **4 MB** (`4_000_000` bytes — the exact same cap `UTGIFT_KVITTERING_FOR_STOR` already uses for receipt images) and does the upload as one ordinary authenticated POST, exactly like `app/api/upload/route.ts` and the `kvittering` route already do. A `tegning` (drawing) scanned at a resolution that exceeds 4 MB is out of scope for this plan — note it to the human partner as a known limitation, do not build around it.
- **Allowed file types are a fixed allowlist, detected from file signature bytes, never trusted from the client's declared MIME type or filename extension:** PDF, JPEG, PNG, WebP, GIF. This mirrors `lib/utgift.ts`'s existing `detekterBildeformat` exactly (same technique, extended with a PDF signature check) — never accept arbitrary file types; reject anything the signature check doesn't recognize with a clear Norwegian message, the same way `UTGIFT_KVITTERING_UGYLDIG_FORMAT` does today.
- **`kategori` is a fixed 6-value allowlist taken verbatim from spec §7.7, not free text:** `kontrakt`, `faktura`, `kvittering`, `bilde`, `tegning`, `annet`. Validate server-side with a typeguard (`erGyldigDokumentKategori`), reject anything else with a clear Norwegian message — same discipline `lib/eiendom-status.ts`'s `erGyldigStatus` already applies to `Bolig.status`.
- **`Dokument.eiendomId` is always required; `delprosjektId` is always optional** — this mirrors `Utgift`'s exact shape (a document can belong to the eiendom as a whole, e.g. the purchase contract, or to one specific delprosjekt, e.g. a kitchen supplier's invoice). A `delprosjektId`, when provided, must belong to the same `eiendomId` the upload is attached to — validate this explicitly server-side (look up the `Delprosjekt` row and compare its `eiendomId`); do not trust a client-supplied pair blindly, since a mismatched pair would silently misfile a document under the wrong property.
- **`Dokument.opplastetAvBrukerId` is always required (not optional), unlike `Utgift.betaltAvBrukerId`.** `Utgift` allows a null payer because "driftskonto" (the property's own pooled capital) is a legitimate non-person payer; there is no equivalent concept for who uploaded a file — it is always the logged-in admin performing the action, taken server-side from `krevInnloggetSesjon()`, never from client input.
- **Delete order: delete the Blob object first, then the `Dokument` row — never the reverse.** If the Blob `del()` call fails (network error, already gone, etc.), the `Dokument` row must stay intact and the delete action must report failure — leaving a document the UI still shows and whose `GET` route still works, rather than silently orphaning an unreachable, un-listed blob with no `Dokument` row left to ever retry or notice it from. This is the same "fail loud, don't half-delete" instinct as this codebase's existing delete actions (`slettKapitalinnskudd`, `slettUtgift`), extended to a two-system delete.
- **`lib/dokument.ts` never imports `@vercel/blob` and never calls `put`/`get`/`del`.** It only reads/writes the `Dokument` Prisma table, taking `blobPathname`/`mimeType`/`storrelse` as plain inputs it was already given. All three Blob calls live in the Task 2 route handlers. This keeps `lib/dokument.ts`'s tests on the same `createTestDb()` real-SQLite pattern every other `lib/*.ts` test file uses, with zero network/Blob mocking needed at that layer.
- NOK/norsk dato/Europe/Oslo conventions from the top-level spec apply here too, where relevant (upload timestamps, displayed dates).
- Any logged-in admin may upload, view, and delete any document on any eiendom — no role-based access control, consistent with every other feature in this codebase so far (spec §6: Fase 1-brukere er kun de fire eierne, alle med samme rolle/adgang).

## Review Focus

Updated after a claudex round (Codex, see `2026-10-27-dokumenter-REVIEW-LOG.md`) that found four concrete gaps in the first draft — folded into the constraints and tasks below, and repeated here as the focus points to verify during implementation review:

- A public (non-private) Blob store, or any code path that reads a document without going through the authenticated `GET /api/dokumenter/[id]` route, would leak financial/legal documents the same way a `salgssum` leak would — check this first.
- File-type validation must be by signature bytes, not by trusting the client's `Content-Type` or the filename's extension — a renamed `.exe` claiming to be `image/png` must be rejected.
- `delprosjektId`, when provided, must be validated as belonging to the same `eiendomId` — an admin on Eiendom A's upload form must not be able to attach a document to Eiendom B's delprosjekt by tampering with the request.
- The delete ordering (Blob first, then DB row) must hold even when the Blob delete fails — verify the `Dokument` row survives a failed Blob delete, not just the happy path.
- The 4 MB cap and the signature-based type check must both be enforced server-side in the route handler, not only in client-side form validation (which is advisory only and trivially bypassed).
- **A `Dokument` metadata-insert failure after a successful Blob upload must not orphan the uploaded file** — this includes the race where the `Bolig` (or `Delprosjekt`) a document is being attached to is deleted concurrently, between the upload route's existence check and its `opprettDokument` call, causing the FK insert itself to fail — tested in Task 2 (compensating Blob delete on insert failure).
- **`Content-Disposition`'s filename must survive non-ASCII characters (e.g. an en dash, `"–"`), quotes, and other bytes the HTTP `Headers` API's ByteString requirement rejects in a raw header value** — a document named with any of these must still download correctly, not throw a server error — tested in Task 2 (`GET` route).
- **Deleting a `Bolig` whose only dependent rows are `Dokument`s must return the same kind of clear, specific 409 the three existing dependency checks already give**, not an unhandled 500 or a misleading message naming only the three pre-existing dependencies — tested in Task 2 (the existing `app/api/boliger/[id]/route.ts` `DELETE` handler gets a fourth check).

---

## Task 1: `Dokument` model and `lib/dokument.ts`

**Files:**
- Modify: `prisma/schema.prisma` (add `model Dokument`; add back-relations on `Bolig`, `Delprosjekt`, `AdminUser`)
- Create: migration via `npx prisma migrate dev --name add_dokument`
- Create: `lib/dokument.ts`
- Test: `lib/dokument.test.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces (for Task 2 and Task 3):
  - `export const DOKUMENT_KATEGORIER = ["kontrakt", "faktura", "kvittering", "bilde", "tegning", "annet"] as const;`
  - `export type DokumentKategori = (typeof DOKUMENT_KATEGORIER)[number];`
  - `export function erGyldigDokumentKategori(verdi: unknown): verdi is DokumentKategori` — typeguard, `typeof verdi === "string" && (DOKUMENT_KATEGORIER as readonly string[]).includes(verdi)`.
  - `export const KATEGORI_LABELS: Record<DokumentKategori, string> = { kontrakt: "Kontrakt", faktura: "Faktura", kvittering: "Kvittering", bilde: "Bilde", tegning: "Tegning", annet: "Annet" };`
  - `export const DOKUMENT_FEIL = "Fant ikke dokumentet.";`
  - `export async function opprettDokument(prisma: PrismaClient, input: { eiendomId: number; delprosjektId?: number; kategori: DokumentKategori; navn: string; blobPathname: string; mimeType: string; storrelse: number; opplastetAvBrukerId: number }): Promise<Dokument>` — plain insert, no validation beyond what Prisma's own types enforce (the route handler in Task 2 validates everything — this function trusts its caller, exactly like `opprettKapitalinnskudd`/`opprettUtgift` already do).
  - `export async function hentDokumenterForEiendom(prisma: PrismaClient, eiendomId: number): Promise<Array<{ id: number; kategori: string; navn: string; mimeType: string; storrelse: number; opprettet: Date; delprosjektId: number | null; delprosjektNavn: string | null; opplastetAvBrukerId: number; opplastetAvNavn: string }>>` — `select`s only what's needed for display (never `blobPathname` in this list — see next function), joins `delprosjekt: { select: { navn: true } }` and `opplastetAvBruker: { select: { navn: true } }` (the established `select`-only-`{id,navn}`-equivalent convention), ordered `{ opprettet: "desc" }`.
  - `export async function hentDokumentForNedlasting(prisma: PrismaClient, id: number): Promise<{ blobPathname: string; mimeType: string; navn: string } | null>` — the one place `blobPathname` is ever read back out of the database; returns `null` if the row doesn't exist. Used only by the Task 2 download route, which is itself auth-gated — `blobPathname` is never sent to the browser in any JSON response (the list function above deliberately omits it).
  - `export async function slettDokumentRad(prisma: PrismaClient, id: number): Promise<{ blobPathname: string }>` — looks the row up first (to return its `blobPathname` to the caller, which per the Global Constraints must delete the Blob object *before* this function is even called — see Task 2), throws `new Error(DOKUMENT_FEIL)` if not found, otherwise deletes the row and returns `{ blobPathname: rad.blobPathname }`. Naming note: this function only ever deletes the **database row** — the route handler in Task 2 calls Blob's `del()` itself, first, and only calls this function after that succeeds.
  - `export async function hentDelprosjektEiendomId(prisma: PrismaClient, delprosjektId: number): Promise<number | null>` — returns the `eiendomId` a given `Delprosjekt` belongs to, or `null` if it doesn't exist. Used by Task 2's upload route to validate a client-supplied `(eiendomId, delprosjektId)` pair belongs together.
  - `export async function harDokumenter(prisma: PrismaClient, eiendomId: number): Promise<boolean>` — mirrors `harDelprosjekter`/`harKapitalinnskudd`/`harUtgifter`'s exact existing shape (`prisma.dokument.count({ where: { eiendomId } }) > 0` or equivalent). Used by Task 2 to extend the existing `app/api/boliger/[id]/route.ts` `DELETE` handler's fast-path dependency checks — a `Bolig` with `Dokument` rows must be blocked from deletion the same way one with delprosjekter/kapitalinnskudd/utgifter already is.

- [ ] **Step 1: Write failing tests for the category helpers and `opprettDokument`/`hentDokumenterForEiendom` in `lib/dokument.test.ts`**

Using `createTestDb()` (same pattern as `lib/kapitalinnskudd.test.ts`), cover:
- `erGyldigDokumentKategori` returns `true` for all 6 values in `DOKUMENT_KATEGORIER`, `false` for `""`, `"ukjent"`, `null`, `undefined`, `123`.
- `KATEGORI_LABELS` has a non-empty Norwegian string for every value in `DOKUMENT_KATEGORIER`.
- `opprettDokument` with a full valid input creates a row; the returned record's `kategori`/`navn`/`blobPathname`/`mimeType`/`storrelse`/`opplastetAvBrukerId`/`eiendomId` all match what was passed in, `delprosjektId` is `null` when omitted.
- `hentDokumenterForEiendom` on an eiendom with two documents (one with a `delprosjektId`, one without) returns both, newest first, each row's `delprosjektNavn` is the delprosjekt's `navn` (or `null` when the document has no `delprosjektId`), and `opplastetAvNavn` is the uploader's `navn`.
- `hentDokumenterForEiendom` on an eiendom with no documents returns `[]`.
- `hentDokumenterForEiendom`'s returned rows never contain a `blobPathname` key (it is not in the type, but assert this directly on the runtime object too — `expect(rad).not.toHaveProperty("blobPathname")` — this is the same defensive-test discipline `lib/eiendom.test.ts` already applies to `kjopesum`/`finansiering`/`salgssum`, now applied to the field that stands in for a secret in this feature).

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run lib/dokument.test.ts`
Expected: FAIL (module `lib/dokument.ts` does not exist yet).

- [ ] **Step 3: Add `model Dokument` to `prisma/schema.prisma`**

```prisma
model Dokument {
  id                  Int          @id @default(autoincrement())
  eiendomId           Int
  eiendom             Bolig        @relation(fields: [eiendomId], references: [id])
  delprosjektId       Int?
  delprosjekt         Delprosjekt? @relation(fields: [delprosjektId], references: [id])
  kategori            String
  navn                String
  blobPathname        String
  mimeType            String
  storrelse           Int
  opplastetAvBrukerId Int
  opplastetAvBruker   AdminUser    @relation(fields: [opplastetAvBrukerId], references: [id])
  opprettet           DateTime     @default(now())
}
```

Add `dokumenter Dokument[]` to `model Bolig`, `model Delprosjekt`, and `model AdminUser` (back-relation fields — no `@relation` name needed on any of the three since each model has only this one relation to `Dokument`).

- [ ] **Step 4: Generate the migration and reconcile migration history**

Run: `npx prisma migrate dev --name add_dokument`

This worktree has hit Prisma migration-checksum drift on every `migrate dev` run so far (seen on the Utgift, Kapitalinnskudd, and Innstilling/`salgssum` migrations already). If it recurs:
1. Apply the equivalent `CREATE TABLE "Dokument" (...)` SQL by hand against `dev.db` via `sqlite3`, matching the column types/nullability above exactly.
2. Write a migration file under `prisma/migrations/<timestamp>_add_dokument/migration.sql` with that exact SQL.
3. Record it as applied: `npx prisma migrate resolve --applied <timestamp>_add_dokument`.

Do not run `prisma migrate reset`. Then run `npx prisma generate`.

- [ ] **Step 5: Implement `lib/dokument.ts`**

Per the Interfaces block above. `opprettDokument` is a plain `prisma.dokument.create`. `hentDokumenterForEiendom` is a `findMany` with the `select` described above. `hentDokumentForNedlasting` and `slettDokumentRad` are simple `findUnique`/`delete` calls — follow `hentKvittering`'s shape in `lib/utgift.ts` for the "return null if not found vs. throw if not found" distinction (the download path returns `null` for a 404; the delete path throws `DOKUMENT_FEIL`, matching `slettKapitalinnskudd`'s convention exactly). `hentDelprosjektEiendomId` is a `findUnique({ where: { id }, select: { eiendomId: true } })` returning `rad?.eiendomId ?? null`.

- [ ] **Step 6: Run the tests, verify they pass**

Run: `npx vitest run lib/dokument.test.ts`
Expected: PASS

- [ ] **Step 7: Write failing tests for `hentDokumentForNedlasting`, `slettDokumentRad`, and `hentDelprosjektEiendomId`**

Add to `lib/dokument.test.ts`:
- `hentDokumentForNedlasting` on an existing document returns `{ blobPathname, mimeType, navn }` matching what was stored; on a non-existent id returns `null`.
- `slettDokumentRad` on an existing document returns `{ blobPathname }` matching the stored value, and a subsequent `hentDokumenterForEiendom` no longer includes it.
- `slettDokumentRad` on a non-existent id throws an `Error` whose `.message === DOKUMENT_FEIL`, matching `slettKapitalinnskudd`'s existing failure-mode test in `lib/kapitalinnskudd.test.ts`.
- `hentDelprosjektEiendomId` on an existing delprosjekt returns its `eiendomId`; on a non-existent id returns `null`.
- `harDokumenter` returns `false` for an eiendom with no documents, `true` once one exists — same two-case coverage `lib/delprosjekt.ts`'s existing `harDelprosjekter` test already has.

- [ ] **Step 8: Run to verify failure, then confirm these were already implemented in Step 5; run again to verify pass**

Run: `npx vitest run lib/dokument.test.ts`
Expected: PASS (all tests, this file). If any of Step 7's tests fail, fix the Step 5 implementation (not the test) to match the Interfaces contract.

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/dokument.ts lib/dokument.test.ts app/generated
git commit -m "feat: add Dokument model and lib/dokument.ts metadata layer"
```

---

## Task 2: Blob-backed upload, download, and delete routes

**Files:**
- Modify: `package.json` (dependency: `@vercel/blob`)
- Create: `app/api/dokumenter/route.ts` (POST — upload)
- Create: `app/api/dokumenter/[id]/route.ts` (GET — download; DELETE — delete)
- Test: `app/api/dokumenter/route.test.ts`
- Test: `app/api/dokumenter/[id]/route.test.ts`
- Modify: `app/api/boliger/[id]/route.ts` (`DELETE` — add a `harDokumenter` fast-path check and extend the FK-race fallback message; Codex round 1, DOC-004)
- Modify: `app/api/boliger/[id]/route.test.ts` (test the new check)

**Interfaces:**
- Consumes: everything from Task 1's `lib/dokument.ts` exports, plus `krevInnloggetSesjon` from `lib/auth.ts` (the existing shared auth guard every protected route already uses).
- Produces: nothing consumed by Task 3's server components directly (Task 3's UI calls these routes via `fetch` from a client component, the same way `UtgiftPanel.tsx` calls `/api/utgifter/[id]/kvittering`), but Task 3 depends on these routes' exact request/response shapes, documented in each step below.

- [ ] **Step 0: Provision the Vercel Blob store (manual, one-time, outside this plan's test loop)**

This is a one-time setup step for whoever runs this plan, not something a test can verify. In the linked Vercel project (`lin-eiendom`), run, from the main repo checkout (not this worktree — Vercel project links live at the repo root):

```bash
vercel blob create-store dokumenter --access private --yes
```

(`--yes` connects the store's `BLOB_READ_WRITE_TOKEN` to all environments including Development, which local `vercel env pull` reads from. If the installed `vercel` CLI is too old to recognize `--yes`/`--environment` on `create-store`, upgrade first: `npm i -g vercel@latest`.)

Then pull the new env var locally: `vercel env pull` (run from the repo root; copy the resulting `BLOB_READ_WRITE_TOKEN` line into this worktree's own `.env`/`.env.local` if the worktree doesn't share the root's env file).

If this step cannot be completed (no Vercel account access in this environment), **stop and report BLOCKED** — Steps 2 onward need a real store to test the happy path against a mocked SDK call; the mock means the actual store only needs to exist for the human partner's own later manual verification (Task 3 Step 9), not for this task's automated tests, so a missing store blocks Task 3's manual check but does **not** block this task's own test suite. Proceed with Steps 1+ regardless, and note the missing provisioning as a concern in your report.

- [ ] **Step 1: Install `@vercel/blob`**

Run: `npm install @vercel/blob`

- [ ] **Step 2: Write failing tests for `POST /api/dokumenter` in `app/api/dokumenter/route.test.ts`**

Follow the `vi.hoisted` prisma-mock pattern already used in `app/api/boliger/route.test.ts` (`vi.hoisted` because Vitest hoists `vi.mock` calls above other `const` initializers). Mock three things: `@/lib/prisma` (a `prisma` named export), `next-auth`'s `getServerSession`, and — new for this codebase — `@vercel/blob`'s `put` function:

```ts
const { prismaMock, putMock, delMock } = vi.hoisted(() => ({
  prismaMock: {
    dokument: { create: vi.fn() },
    delprosjekt: { findUnique: vi.fn() },
    bolig: { findUnique: vi.fn() },
  },
  putMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "7", role: "eier" } }) }));
vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock }));
```

(`del` is mocked here too, not just in `[id]/route.test.ts` — this route's own compensating-cleanup path, see below, calls it directly on an insert failure. `bolig.findUnique` is required — Codex round 2, DOC-006 — because Step 4's implementation looks the `Bolig` up before uploading; every test below must set `prismaMock.bolig.findUnique.mockResolvedValue({ id: <eiendomId> })` for its "existing property" cases, and `mockResolvedValue(null)` for a dedicated "missing property → 404, no Blob/DB calls" case. Reset all four mocked functions in a `beforeEach`, matching the established convention in `app/api/boliger/route.test.ts`/`[id]/route.test.ts`.)

Cover:
- No session (or a legacy session without `user.id` — same `krevInnloggetSesjon` convention every other protected route already uses) → `401`, and `putMock`/`prismaMock.dokument.create` are never called.
- No `file` field in the FormData → `400`, clear Norwegian message, no Blob/DB calls.
- A file whose first bytes don't match any of PDF/JPEG/PNG/WebP/GIF's signature → `400` with a Norwegian "ugyldig filformat" message (mirroring `UTGIFT_KVITTERING_UGYLDIG_FORMAT`'s wording style), no Blob/DB calls. Build the test file's bytes directly (e.g. `new Blob([new Uint8Array([0x00, 0x01, 0x02])])`) — do not rely on a real file fixture.
- A file over 4 MB (construct a `Blob`/`File` whose `.size` is `4_000_001` — you do not need real content of that size for a FormData test, just a correctly-sized `Blob`) → `413`, no Blob/DB calls.
- An invalid `kategori` (not one of the 6 allowed values) → `400`, no Blob/DB calls.
- A non-existent `eiendomId` (`prismaMock.bolig.findUnique` resolves `null`) → `404`, no Blob/DB calls (Codex round 2, DOC-006 — this case was missing from the original draft even though Step 4 always performs this lookup).
- A `delprosjektId` that doesn't belong to the given `eiendomId` (mock `prismaMock.delprosjekt.findUnique` to return a row with a *different* `eiendomId`) → `400` with a clear message, no Blob/DB calls.
- The happy path (valid PNG-signature bytes, valid `kategori`, no `delprosjektId`) → `putMock` is called with `access: "private"` (assert this explicitly — a regression here would silently make documents public), the route awaits its resolved `{ pathname }`, and `prismaMock.dokument.create` is called with that exact `pathname` as `blobPathname` plus the authenticated session's `id` as `opplastetAvBrukerId` (not any client-supplied value) — then the route returns `200`/`201` with the created document's `id`.
- **Compensating cleanup (Codex round 1, DOC-001):** `putMock` resolves successfully, but `prismaMock.dokument.create` rejects (simulating, among other causes, the `Bolig` or `Delprosjekt` being deleted concurrently between this route's existence checks and the insert — a real race with `DELETE /api/boliger/[id]`, which has no lock preventing it). Assert `delMock` is called with the exact `pathname` `putMock` resolved, and that the route returns a `5xx`/clear error response rather than crashing uncaught. Also cover: `delMock` itself rejects in this same scenario (the Blob object is now leaked) — the route must still return an error response instead of throwing an unhandled rejection; log the leak (a `console.error` is sufficient for a 4-person internal tool, no retry queue) rather than silently swallowing it.

- [ ] **Step 3: Run the tests, verify they fail**

Run: `npx vitest run app/api/dokumenter/route.test.ts`
Expected: FAIL (route module doesn't exist yet).

- [ ] **Step 4: Implement `detekterDokumentformat` and `POST` in `app/api/dokumenter/route.ts`**

Add a small signature-detection helper in this same file (not exported from `lib/dokument.ts` — it is route-layer input validation, the same way `detekterBildeformat` sits in `lib/utgift.ts` next to the kvittering upload code it serves; here there is no equivalent shared lib module to put it in, since `lib/dokument.ts` is explicitly storage-agnostic per the Global Constraints, so keep it local to this route file and reuse it from Task 2's own `[id]` route only if needed — it currently isn't). Extend the exact byte-signature technique from `lib/utgift.ts`'s `detekterBildeformat` (copy its JPEG/PNG/GIF/WebP checks) and add: PDF — `startsWithAscii(bytes, "%PDF-", 0)`.

`POST` handler, in order:
1. `krevInnloggetSesjon()` → `401` if not logged in.
2. Parse `formData()`; require `file` (a `File`), `eiendomId` (parseable integer), `kategori` (string), optional `delprosjektId` (parseable integer), optional `navn` (string, default to `file.name` if absent).
3. Validate `file.size <= 4_000_000` → `413` with a Norwegian message if over.
4. Read `file.arrayBuffer()` into a `Buffer`, run `detekterDokumentformat` → `400` with a Norwegian message if unrecognized.
5. Validate `kategori` via `erGyldigDokumentKategori` → `400` if not one of the 6.
6. Validate `eiendomId` is a real `Bolig` (reuse the same existence-check style `app/api/boliger/[id]/route.ts` already does) → `404`/`400` if not.
7. If `delprosjektId` is present, call `hentDelprosjektEiendomId` and compare to `eiendomId` → `400` with a clear message if it doesn't match (or doesn't exist).
8. Call `put(pathname, buffer, { access: "private", contentType: detectedMimeType })` where `pathname` is built as `` `dokumenter/eiendom-${eiendomId}/${Date.now()}-${navn}` `` (sanitize `navn` first — strip anything that isn't alphanumeric, `.`, `-`, or `_`, to keep the Blob pathname well-formed regardless of what filename a browser sends).
9. Call `opprettDokument` with the resolved `blobPathname` (the `pathname` the `put()` call returned, not the one you constructed — Blob may have altered it, e.g. via its own suffixing), `mimeType` (the detected one, not the client's claimed one), `storrelse: file.size`, and `opplastetAvBrukerId` from the session.
10. **(Codex round 1, DOC-001) Wrap Step 9 in a try/catch.** On failure (most likely cause: the `Bolig`/`Delprosjekt` was deleted between Steps 6–7's existence checks and this insert, making the FK constraint fail — a real race, since nothing in this plan locks the row in between), call `del(blobPathname)` to remove the now-orphaned Blob object before returning an error response. Wrap that `del()` call in its own try/catch too — if it also fails, `console.error` the leaked pathname (so it is at least discoverable in logs) and still return the original error response; do not let a failed cleanup attempt mask the original failure or throw uncaught.
11. Return `201` with the created document (or just its `id` — Task 3 doesn't need more than that to trigger a `router.refresh()`).

- [ ] **Step 5: Run the tests, verify they pass**

Run: `npx vitest run app/api/dokumenter/route.test.ts`
Expected: PASS

- [ ] **Step 6: Write failing tests for `GET`/`DELETE /api/dokumenter/[id]` in `app/api/dokumenter/[id]/route.test.ts`**

Mock `@/lib/prisma`, `next-auth`, and `@vercel/blob`'s `get`/`del` functions (same `vi.hoisted` pattern). Cover:
- `GET` with no session → `401`.
- `GET` for a non-existent id → `404` (the `hentDokumentForNedlasting` call returns `null`).
- `GET` for an existing document → calls `get(blobPathname, { access: "private" })`, and on a successful result (mock a `{ statusCode: 200, stream: <some readable> }`-shaped response matching the real SDK's `get` return shape) streams the body back with `Content-Type` set to the stored `mimeType` and `Cache-Control: private, no-store` (same caching convention `kvittering`'s `GET` route already uses).
- **(Codex round 1, DOC-002) `Content-Disposition` with a non-ASCII/quote-containing `navn`:** a document stored with `navn: 'Kontrakt – signert.pdf'` (en dash) must produce a response whose `Content-Disposition` header the `Headers`/`Response` API accepts without throwing — raw header values are restricted to ByteString (Latin-1), so a raw en dash in a bare `filename="..."` parameter is exactly the kind of value that throws when the response is constructed. Assert the route builds the header with the two-part form (ASCII fallback plus a `filename*=UTF-8''...` percent-encoded parameter — see Step 8) and that constructing/returning the response does not throw for this `navn`. Also cover a `navn` containing a double quote (`'kvittering "ny".pdf'`) and a `navn` containing a newline/control character — neither may produce a malformed or injectable header.
- `DELETE` with no session → `401`, and neither `delMock` nor any DB delete is called.
- `DELETE` for a non-existent id → `404`, `delMock` is never called (there is nothing to delete from Blob if the DB row was never found — call `hentDokumentForNedlasting` or equivalent first to get the `blobPathname`, exactly as the Global Constraints' delete-ordering rule requires you to have the pathname *before* attempting any delete).
- `DELETE` where the Blob `del()` call rejects/throws → the route returns a `5xx` (or a clear `4xx` with an error message — your call, document which), and `prismaMock.dokument.delete` (or whatever `slettDokumentRad` resolves to under the mock) is **never called** — this is the single most important test in this file; it is what proves the delete-ordering constraint actually holds in code, not just in the plan's prose.
- `DELETE` happy path → `del()` is called with the document's `blobPathname`, and only after it resolves does `slettDokumentRad` run; the route returns `200`.

- [ ] **Step 7: Run the tests, verify they fail**

Run: `npx vitest run app/api/dokumenter/\[id\]/route.test.ts`
Expected: FAIL (route module doesn't exist yet).

- [ ] **Step 8: Implement `GET` and `DELETE` in `app/api/dokumenter/[id]/route.ts`**

`GET`: `krevInnloggetSesjon()` guard → `401`. Parse/validate the numeric `id` the same way every sibling `[id]` route already does (`400` for a non-numeric id). `hentDokumentForNedlasting` → `404` if `null`. Call `get(blobPathname, { access: "private" })`; if the result is `null`/not found, return `404` (the DB row and the Blob object have drifted out of sync — treat it the same as a missing file, don't crash). Otherwise stream `result.stream` (or whatever field the installed `@vercel/blob` version's `get()` actually returns — check its type definitions in `node_modules/@vercel/blob` once it's installed in Step 1, don't guess the shape) back in a `NextResponse`, with `Content-Type`, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store` headers — matching `kvittering`'s `GET` route's header set, plus a safely-encoded `Content-Disposition` (Codex round 1, DOC-002; refined round 2, DOC-005): build a small local helper (e.g. `contentDisposition(navn: string): string`) that strips control characters (`\r`, `\n`, and other C0 controls) from `navn` entirely, derives an ASCII-only fallback by replacing every non-ASCII/`"`/`\` character with `_`, and builds the RFC 5987 `filename*` value as `encodeURIComponent(navnUtenKontrolltegn)` with an **additional** pass that percent-encodes the characters `encodeURIComponent` itself leaves untouched but RFC 5987's `attr-char` still excludes — `'`, `(`, `)`, and `*` (e.g. `.replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())`) — `encodeURIComponent` alone is not RFC 5987-safe (confirmed against this project's own installed `next/dist/compiled/content-disposition` parser, which rejects a raw `'`/`(`/`)`/`*` in an extended value). Return `` `attachment; filename="${asciiVariant}"; filename*=UTF-8''${rfc5987Encoded}` ``. Add test cases (Step 6) for a name containing both a non-ASCII character and `'`/`(`/`)` together (e.g. `"Kontrakt – signert (1).pdf"`) and confirm the resulting header round-trips through `next/dist/compiled/content-disposition`'s own parser (already a project dependency via Next.js — `import contentDisposition from "next/dist/compiled/content-disposition"` is available for the test to verify against, or use Node's built-in `new Response(...).headers.get(...)` construction not throwing as the test's assertion if parsing the header back out is awkward in the test environment — your call on which verification is more practical, but the header must demonstrably not be rejected by a real parser, not just "look right"). Reuse this same helper from Task 2's own two routes if a second spot ever needs it — there is only one right now.

`DELETE`: `krevInnloggetSesjon()` guard → `401`. Validate the numeric id. Call `hentDokumentForNedlasting` (or add a small internal helper if the exact shape needed differs — your call, but do not call `slettDokumentRad` yet) → `404` if not found. Call `del(blobPathname)` and **await it before doing anything else** — if it throws, catch and return an error response without ever calling `slettDokumentRad`. Only on a successful Blob delete, call `slettDokumentRad(prisma, id)` and return `200`.

- [ ] **Step 9: Run the tests, verify they pass**

Run: `npx vitest run app/api/dokumenter/\[id\]/route.test.ts`
Expected: PASS

- [ ] **Step 10: (Codex round 1, DOC-004; corrected round 2, DOC-006) Write a failing test for the existing `DELETE /api/boliger/[id]` route's new document check**

**Correction from the first draft:** `app/api/boliger/[id]/route.test.ts` does not mock `harDelprosjekter`/`harKapitalinnskudd`/`harUtgifter` as functions — it mocks the underlying Prisma client directly (`prismaMock.delprosjekt.count`, `prismaMock.kapitalinnskudd.count`, `prismaMock.utgift.count`, each reset in an existing `beforeEach`), and the real `har*` functions run unmocked against those mocked `count` calls. Follow that exact existing convention, not a function-level mock: add `dokument: { count: vi.fn() }` to that file's `prismaMock` object, add `prismaMock.dokument.count.mockReset()` to the existing `beforeEach` alongside the other three resets, then:
- `prismaMock.dokument.count.mockResolvedValue(1)` (and the three existing checks' counts at `0`) → `DELETE` returns `409` with a message specifically about documents (e.g. `"Kan ikke slette en eiendom med registrerte dokumenter."`), and `prismaMock.bolig.delete` is never called.
- The existing P2003-race fallback test(s) must have `prismaMock.dokument.count` explicitly set to `0` too (it is a new mock the existing tests don't know to set — without this, Vitest's default mocked-function return of `undefined` could make the new fast-path check behave unpredictably), so they still reach the `prisma.bolig.delete` call and its catch block as before. Update that test's asserted message text to the extended wording from Step 11.

- [ ] **Step 11: Run to verify failure, then implement**

Run: `npx vitest run app/api/boliger/\[id\]/route.test.ts`
Expected: FAIL, then: import `harDokumenter` from `@/lib/dokument` into `app/api/boliger/[id]/route.ts`; add a fourth fast-path check in `DELETE`, in the same position/style as the other three (`if (await harDokumenter(prisma, eiendomId)) return NextResponse.json({ error: "Kan ikke slette en eiendom med registrerte dokumenter." }, { status: 409 });`); and extend the P2003 catch-all's message from `"Kan ikke slette en eiendom med registrerte delprosjekter, kapitalinnskudd eller utgifter."` to also name documents (`"...delprosjekter, kapitalinnskudd, utgifter eller dokumenter."`). Re-run to verify PASS.

- [ ] **Step 12: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 13: Commit**

```bash
git add package.json package-lock.json app/api/dokumenter "app/api/boliger/[id]/route.ts" "app/api/boliger/[id]/route.test.ts"
git commit -m "feat: add Blob-backed document upload, download, and delete routes"
```

---

## Task 3: Dokumenter page, upload/list panel, and nav links

**Files:**
- Create: `app/admin/(protected)/boliger/[id]/dokumenter/page.tsx`
- Create: `app/admin/(protected)/boliger/[id]/dokumenter/DokumentPanel.tsx`
- Modify: `app/admin/(protected)/boliger/[id]/page.tsx` (add nav link)
- Modify: `app/admin/(protected)/boliger/[id]/kapital/page.tsx` (add nav link)
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx` (add nav link)
- Modify: `app/admin/(protected)/boliger/[id]/fortjeneste/page.tsx` (add nav link)

**Interfaces:**
- Consumes: `hentDokumenterForEiendom`, `DOKUMENT_KATEGORIER`, `KATEGORI_LABELS` (Task 1); `POST /api/dokumenter`, `GET /api/dokumenter/[id]`, `DELETE /api/dokumenter/[id]` (Task 2).
- Produces: nothing consumed by an earlier task (this is the last task).

- [ ] **Step 1: Build `app/admin/(protected)/boliger/[id]/dokumenter/page.tsx`**

Server component, following `kapital/page.tsx`'s exact shape: `notFound()` if the `Bolig` doesn't exist; fetch `eiendom.delprosjekter` (for the upload form's optional delprosjekt dropdown — reuse the `{ id, navn }` projection `delprosjekter/page.tsx` already passes to its own panels) and `hentDokumenterForEiendom(prisma, eiendomId)`. Render the same header-nav block pattern as the other three sibling pages (back link to the Bolig, cross-links to Delprosjekter/Kapital/Fortjeneste), then a single panel: `<DokumentPanel eiendomId={eiendomId} delprosjekter={...} dokumenter={...} />`. Add `export const dynamic = "force-dynamic";`.

- [ ] **Step 2: Build `DokumentPanel.tsx`**

`"use client"` component, modeled on `UtgiftPanel.tsx`'s shape (form + list in one component) but simpler — there's no "create the row first, then attach the file" two-step dance here, since the file *is* the document:

- **Upload form:** delprosjekt dropdown (same `INGEN_DELPROSJEKT = ""` sentinel pattern as `UtgiftPanel.tsx`, labeled "Ingen (eiendom)"), kategori dropdown (`DOKUMENT_KATEGORIER.map(...)`, labels from `KATEGORI_LABELS`), a file input (`accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"` — advisory only, the server is the real gate per Global Constraints), and an optional "Navn" text input (defaults to the selected file's name if left blank — set this client-side when a file is chosen, same convenience `UtgiftPanel.tsx` doesn't need but is a one-line improvement here). On submit: build a `FormData` with `file`, `eiendomId`, `kategori`, `delprosjektId` (only if set), `navn` (only if non-empty), `POST` to `/api/dokumenter`. On a non-OK response, parse and show the JSON `error` field (same try/catch-non-JSON defensiveness `UtgiftPanel.tsx`'s kvittering upload already has, since an error page could come back as HTML instead of JSON). On success, reset the form and `router.refresh()`.
- **List filters (Codex round 1, DOC-003 — the plan's own Goal line promises filtering; this closes that gap):** two controls above the list, independent of the upload form's own dropdowns and using their own local `useState` — a kategori filter (`"alle"` default, plus the 6 `DOKUMENT_KATEGORIER` values) and a delprosjekt filter (`"alle"` default, "Ingen (eiendom)" as an explicit option, plus each delprosjekt). Filter the `dokumenter` prop client-side (`.filter(...)`, no network round-trip — the full list for one eiendom is already in hand) before rendering rows; an empty filtered result renders the same "no documents" empty-state message the unfiltered list uses when there are zero documents at all, not a blank list with no explanation. The two filters combine (AND, not OR).
- **List:** one row per document — `navn`, a `KATEGORI_LABELS[kategori]` badge, `delprosjektNavn` (or nothing, if eiendom-level), `opplastetAvNavn`, the date (`nb-NO`/`Europe/Oslo` formatting matching every sibling list), file size (`(storrelse / 1_000_000).toFixed(1)` + " MB", or similar human-readable formatting — your call on exact wording), a "Last ned" link that is a plain `<a href={`/api/dokumenter/${d.id}`}>` (the browser handles the authenticated download directly — no client-side fetch needed, since the route itself sends `Content-Disposition: attachment`), and a "Slett" button with the same `window.confirm(...)` → call a thin client-side `fetch(`/api/dokumenter/${id}`, { method: "DELETE" })` → `router.refresh()` pattern `UtgiftPanel.tsx`'s `handleSlett` already uses (there is no Server Action for delete in this plan — Task 2 already built an authenticated `DELETE` route, so the client calls that directly, rather than this plan inventing a parallel Server Action that would just re-wrap the same route).

- [ ] **Step 3: Add "Dokumenter" nav links**

In `app/admin/(protected)/boliger/[id]/page.tsx`, `kapital/page.tsx`, `delprosjekter/page.tsx`, and `fortjeneste/page.tsx`: add a `Link` to `/admin/boliger/${eiendomId}/dokumenter` labeled "Dokumenter" alongside each page's existing cross-links to its siblings, matching the exact `<Link>`/separator pattern already used in each file. And in the new `dokumenter/page.tsx` itself, add the reverse links (to Delprosjekter, Kapital, Fortjeneste) the same way `fortjeneste/page.tsx` already links to its three siblings.

- [ ] **Step 4: Manual verification**

Start the dev server if not already running (`./start-dev.sh`). Confirm the Blob store from Task 2 Step 0 is provisioned and `BLOB_READ_WRITE_TOKEN` is present in this worktree's env (`vercel env pull` if not). Log in, open a Bolig's Dokumenter page, upload a small PDF and a small PNG (one tagged to a delprosjekt, one not), confirm both appear in the list with the right category/delprosjekt/uploader, download each via "Last ned" and confirm the file opens correctly with its original content intact, then delete one and confirm it disappears from the list and a direct `GET` to its old `/api/dokumenter/[id]` URL now 404s. Also confirm an oversized or wrong-format file is rejected with a clear message and never appears in the list.

If a dev server or Vercel account access isn't available in this environment, do the strongest static verification possible (typecheck, careful read of the JSX against the actual API response shapes) and say so explicitly in the report as a self-review finding, the same honesty standard the Fortjenestefordeling plan's Task 3 held to when it hit the same limitation.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/boliger/[id]/dokumenter" "app/admin/(protected)/boliger/[id]/page.tsx" "app/admin/(protected)/boliger/[id]/kapital/page.tsx" "app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx" "app/admin/(protected)/boliger/[id]/fortjeneste/page.tsx"
git commit -m "feat: add Dokumenter page with upload/list/delete and cross-page nav links"
```
