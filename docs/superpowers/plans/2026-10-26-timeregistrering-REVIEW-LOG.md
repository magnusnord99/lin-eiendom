# Plan review log — Timeregistrering

- Host: Claude Code (this session). Reviewer: Codex (gpt-6-astra, high effort, read-only sandbox).
- Plan: `docs/superpowers/plans/2026-10-26-timeregistrering.md`
- Spec: `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md`
- Mode: `review` (plan already written; no fresh requirements interview).
- Round limit: 5.

## Round 1 — REVISE (6 findings)

- TR-01 (high): `/api/boliger` POST/PUT forward the full request body to Prisma unfiltered — once Timeregistrering exists, a nested write (`delprosjekter.update.data.timeregistreringer.deleteMany`) could delete another owner's time entries, bypassing the ownership check this plan builds. **Accepted.** Added new Task 1: field allowlist (`plukkSkrivbareBoligFelter`) on both routes, with regression tests using the exact attack payload.
- TR-02 (medium): thrown Server Action errors get replaced with a generic message in production Next.js builds. **Accepted** for the two new actions only (not the pre-existing `opprettDelprosjektAction`, out of scope/systemic). Actions now return a `HandlingResultat<T>` instead of throwing for validation/ownership failures; auth failures still throw.
- TR-03 (medium): `new Date(input.dato)` + `isNaN` accepts "2026-02-30" (silently rolls over) and full timestamp strings. **Accepted.** Added regex + round-trip validation.
- TR-04 (medium): default date computed in UTC, not Europe/Oslo; list displayed raw ISO instead of Norwegian format. **Accepted.** Fixed with `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" })` and string-based `dd.mm.yyyy` formatting.
- TR-05 (medium): `prisma migrate dev` doesn't auto-run `generate` on this Prisma version (recurrence of a Fundament-phase finding). **Accepted.** Explicit `npx prisma generate` step added.
- TR-06 (medium): empty-delprosjekter form keeps a stale/undefined selection after the first delprosjekt is created via `router.refresh()`. **Accepted.** Added a derived `effectiveDelprosjektId`.

## Round 2 — REVISE (3 findings)

- TR-07 (high): `slettTimeregistreringAction` passed `id` straight to `deleteMany({ where: { id, brukerId } })` with no runtime validation — a missing/`undefined`/object `id` either drops out of Prisma's where-filter or becomes a filter operator, bulk-deleting a user's own rows across every property. **Accepted.** Validation moved into `slettTimeregistrering` itself (defense in depth, not just the action), rejecting non-positive-integer ids before touching the database.
- TR-08 (medium): round 1's fix cast `data` to `Prisma.BoligUpdateInput` too early, breaking `resolverEffektivStatus`'s `type?: string` parameter type. **Accepted** — real defect introduced by my own round-1 fix. Reverted to casting only at the two Prisma call sites, not on the variable itself.
- TR-09 (low): the delete action's catch-all returned `err.message` for any exception, leaking internal/Prisma diagnostics on an unexpected failure. **Accepted.** Introduced a shared `TIMEREGISTRERING_EIER_FEIL` constant; only that exact message is returned to the client, everything else is logged server-side and replaced with a generic message.

## Round 3 — APPROVED

No findings. Plan SHA256: `bcfee519ad3f5ff855613ed8a939645ad4f841d163e004f4a459b663f4008df3`.
