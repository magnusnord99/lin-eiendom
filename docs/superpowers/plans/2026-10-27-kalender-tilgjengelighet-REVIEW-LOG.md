# Review log: Kalender & tilgjengelighet plan

Reviewer: Codex (`codex-cli 0.162.1`, `gpt-6-astra`, effort `high`, read-only sandbox)
Host/planner: Claude (this worktree, `worktree-fundament`)
Tool: `claudex-loop:claudex-loop` (`mode=review host=claude reviewer=codex`)

## Round 1 — REVISE

Plan SHA256 at review time: `f66f5e496d81d0477c0057b734239550ee915d9853651070a5e1cc013eece9ce`

- **CAL-001** (high) — Task 3's `prisma.adminUser.findMany` fetched full `AdminUser` rows (including the bcrypt `passord` hash) and passed them to the client component unprojected. **Accepted, fixed**: added explicit `select: { id: true, navn: true }` to both the `adminUser` and `bolig` queries in Task 3 Step 1.
- **CAL-002** (high) — Claimed `tellLedigePerDag` should score true sub-day time-interval overlap across owners, not a same-day count. **Rejected**: the plan's own §3 spec quote is explicit — "...raskt finner overlappende **dager**" (overlapping *days*) — matching the feature's real purpose (coordinating which day all four can work together), not minute-level interval intersection. Added an explicit Global Constraints paragraph citing §3 directly so the interpretation is visible rather than implicit.
- **CAL-003** (medium) — Grid cells only rendered a marker for `"ledig"` rows; no way to see `"ikke_ledig"` status, time intervals, or event details. **Accepted, fixed**: reworked Task 3 Step 2 to distinguish filled/outlined dots per status and added a click-to-open day-detail panel showing every owner's status+interval and full event details, with per-entry delete controls matching the ownership-asymmetry rule.
- **CAL-004** (medium) — Independent `?maned=` and `?dato=` params could diverge, letting week view request data outside the fetched month. **Accepted, fixed**: replaced with a single `?dato=` anchor param that drives both the fetched month and the week-view slice; the month's padded grid always contains the anchor's own week by construction.

## Round 2 — REVISE

Plan SHA256 at review time: `f11ebc2fb769dcb94c52aa6dbff398147d133bb53eb1fb79dafdfe7931c8d68a`

- **CAL-005** (medium) — The anchor-date validation only checked `/^\d{4}-\d{2}-\d{2}$/` format, which syntactically accepts `2026-13-01`/`2026-02-31` (silently normalized by `Date` into a different month). **Accepted, fixed**: specified the same round-trip validation (`registrerTimerAction`'s pattern: parse, re-format, compare to the original string) in Task 3 Step 1, plus explicit rejection of a repeated query param. Added a Review Focus line flagging this for manual verification since page components aren't unit-tested in this codebase's convention.
- Confirmed: CAL-001, CAL-003, CAL-004 resolved; CAL-002's day-level scoring decision accepted as explicit scope.

## Round 3 — APPROVED

Plan SHA256 at approval: `af6d2b9540059a3f005bb8d3fcb974cfdd69b8a7ade1786589d6a18712b15f9c` (matches on-disk file at commit time).

No remaining findings. Coverage: date validation, client-data projections, day-detail display, shared month/week anchor, ownership enforcement, recurrence cap, upsert semantics, time validation, and the `Bolig` deletion dependency guard, all checked against the plan text and existing codebase patterns (seeding, allowlists, race handling).
