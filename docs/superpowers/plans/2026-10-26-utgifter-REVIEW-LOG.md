# Codex review log — Utgifter (expenses) plan

Reviewer: Codex (gpt-6-astra, effort: high), via claudex-loop.
Plan: `docs/superpowers/plans/2026-10-26-utgifter.md`
Final approved SHA256: `9bc907824192e1bb3a10d2396abfd233b34a3076f6b92113a3549b12ba285851`

## Round 1 — REVISE (4 findings)

- **UTG-01 (high):** Reusing `app/api/upload/route.ts` for receipts exposes them publicly — that endpoint writes to `public/uploads`, which Next.js serves with no authentication. Receipts are private financial documents, unlike the public property photos that endpoint currently serves.
- **UTG-02 (high):** In production/serverless, Next.js indexes `public/` at build time; a file written there after deploy 404s forever. A receipt uploaded post-deploy would never be retrievable.
- **UTG-03 (high):** The planned `adminUser.findMany({ where: { rolle: "eier" } })` with no `select` would serialize `passord` (the bcrypt hash) into client component props.
- **UTG-04 (medium):** The migration-checksum-drift fallback (hand-applying SQL) never recorded the migration as applied in `_prisma_migrations`, so a later `migrate deploy` would try to re-run the same `CREATE TABLE` and fail.

**Disposition:** All four accepted. Replaced the entire receipt-storage architecture: bytes stored directly on the `Utgift` row as a Prisma `Bytes` column, retrieved only through a new authenticated route — no filesystem, no new infrastructure. Pinned `select: { id: true, navn: true }` as a Global Constraint for any AdminUser list feeding a client component. Added an explicit `prisma migrate resolve --applied` step to the migration fallback.

## Round 2 — REVISE (3 findings)

- **UTG-05 (high):** Passing receipt bytes as a base64 string argument to a Server Action would hit the default 1 MiB Server Action body-size ceiling, and base64-inflate a 4 MB image past even the stated 4.5 MB platform ceiling.
- **UTG-06 (high):** The client-supplied MIME type was trusted and reflected back as `Content-Type` on retrieval — an authenticated uploader could store HTML or script-bearing SVG under a spoofed `image/*` type.
- **UTG-07 (medium):** The prescribed `hentUtgifterForEiendom` query combined a top-level `select` with `include`, which Prisma's generated types reject outright.

**Disposition:** All three accepted. Split receipt handling into two phases: a Server Action creates the expense metadata only; a separate authenticated Route Handler accepts the raw file as `multipart/form-data` (same transport the existing public upload endpoint already uses successfully) and attaches it afterward. Added `detekterBildeformat`, a magic-byte signature check (JPEG/PNG/GIF/WebP), so the *detected* format — never the client's asserted MIME type — is what gets stored and served, plus `X-Content-Type-Options: nosniff` on retrieval. Rewrote the list query as a single top-level `select` with nested relation selects, no `include`.

## Round 3 — REVISE (1 finding)

- **UTG-08 (medium):** Any upload-phase failure that wasn't a cleanly-parsed JSON error (a network failure, a non-JSON error body) fell into a shared outer catch producing a generic "Noe gikk galt. Prøv igjen." — which reads as "nothing happened," even though the expense row was already created, inviting a resubmit that would create a duplicate expense.

**Disposition:** Accepted. Restructured the submit handler so expense creation and receipt attachment are no longer covered by one shared try/catch. Once creation succeeds, the form resets and the list refreshes immediately, before the receipt upload even starts; every subsequent failure mode (parseable JSON error, unparseable body, or a rejected fetch) is caught separately and always states that the expense was saved.

## Round 4 — REVISE (1 finding)

- **UTG-09 (medium):** The handler refreshed immediately after creation but never again after a successful receipt upload — if the refresh raced ahead of the upload (likely on a slow upload), the client would be stuck showing `harKvittering: false` with no further refresh to pick up the change.

**Disposition:** Accepted. Added a second `router.refresh()` call, fired only on a successful upload response, with a comment explaining why a second refresh is specifically needed here.

## Round 5 — APPROVED

No further findings. Plan SHA256 `9bc907824192e1bb3a10d2396abfd233b34a3076f6b92113a3549b12ba285851` approved for implementation.
