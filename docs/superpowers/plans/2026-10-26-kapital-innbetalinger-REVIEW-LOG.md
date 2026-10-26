# Plan review log — Kapital & innbetalinger

- Host: Claude Code (this session). Reviewer: Codex (gpt-6-astra, high effort, read-only sandbox).
- Plan: `docs/superpowers/plans/2026-10-26-kapital-innbetalinger.md`
- Spec: `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` (§7.3)
- Mode: `review` (plan already written; no fresh requirements interview).
- Round limit: 5.

## Round 1 — REVISE (2 findings)

- KI-01 (medium): `beregnEierandeler` filtered the *output* to `rolle: "eier"` users but summed `totalBelop` over every `Kapitalinnskudd` row regardless of the contributor's current role — a contribution from a brukerId that isn't (or is no longer) `rolle: "eier"` would inflate the denominator without appearing in the numerator, so the displayed eiere's percentages would no longer sum to 100. **Accepted.** The `Kapitalinnskudd.findMany` query itself is now scoped to `brukerId: { in: [...eierIds] }`, so both the per-bruker sum and `totalBelop` are consistent with the output. Added a regression test seeding a non-eier contribution directly via Prisma and asserting it's excluded from both sides of the calculation.
- KI-02 (low): the existing `Bolig` DELETE route's fast-path check and generic `P2003` fallback both assumed any foreign-key block was caused by delprosjekter — inaccurate once `Kapitalinnskudd.eiendomId` also `RESTRICT`s that delete. A property with contributions but zero delprosjekter would get told (falsely) that it has delprosjekter. **Accepted.** Added `harKapitalinnskudd` (mirrors `harDelprosjekter`) as a second fast-path check with its own specific message, and reworded the generic `P2003` catch's message to cover either dependency.

## Round 2 — REVISE (1 finding)

- KI-03 (low): Step 8's test instructions were incomplete — the hoisted `prismaMock` had no `kapitalinnskudd` entry for the new `harKapitalinnskudd` call to hit, and the pre-existing race-condition test still asserted the *old* delprosjekter-only P2003 message even though that message changes once both fast-path checks return 0 (it now falls into the generic combined-message branch). **Accepted.** Added the missing mock entry; corrected the pre-existing test's expected message to the new combined one; removed a redundant "new" P2003-fallback test that — once the fix above is applied — would have been an exact duplicate of the now-corrected pre-existing test.

## Round 3 — APPROVED

No findings. Plan SHA256: `804ab19ba3dbf83a4ae66918c81c6dbcaad8cab458a5432157b63b22bd695ec7`.
