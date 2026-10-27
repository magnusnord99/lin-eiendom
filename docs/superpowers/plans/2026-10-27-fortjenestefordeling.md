# Fortjenestefordeling (profit split) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any admin see, for a given Bolig, exactly how its profit (fortjeneste) is split between the four owners — 80% equally, 10% by work-hours share, 10% by capital share, with the two 10% figures configurable system-wide — with every term of the calculation shown separately so it can be checked by hand, not just a single black-box total.

**Architecture:** A pure calculation module (`lib/fortjeneste.ts`) composes three already-existing per-eiendom aggregates — capital share (`lib/kapitalinnskudd.ts`'s `beregnEierandeler`, pre-existing), a new work-hours-share aggregate in the same file, and total expenses (a new small aggregate in `lib/utgift.ts`) — against the Bolig's purchase price (`kjopesum`, pre-existing on the schema but never exposed in the UI) and a new realized sale price (`salgssum`, new field) to compute `fortjeneste = salgssum - kjopesum - totalUtgifter`, then distributes it per the configurable split. The split percentages live in a new singleton `Innstilling` row (one row for the whole system, not per eiendom — see Global Constraints) editable from a small new settings page. The result is rendered on a new read-only page at `boliger/[id]/fortjeneste`, mirroring the existing `kapital`/`delprosjekter` sibling pages. Nothing computed here is persisted — it is recalculated on every page load from the underlying rows, exactly like `beregnEierandeler` already is.

**Tech Stack:** Next.js 16 App Router server actions + server components, Prisma 7 + libsql, Vitest with the existing `createTestDb()` real-SQLite test helper (the pattern `lib/kapitalinnskudd.test.ts`, `lib/timeregistrering.test.ts`, `lib/utgift.test.ts`, and `lib/eiendom.test.ts` all already use) for `lib/` modules, and the existing `vi.hoisted` prisma-mock pattern (see `app/admin/(protected)/boliger/[id]/kapital/actions.test.ts`) for the one new Server Action.

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` §7.6 (Fortjenestefordeling), with §7.1 (`kjopesum`, already on `Bolig`), §7.3 (`beregnEierandeler`, already implemented) and §7.5 (`Timeregistrering`, already implemented) as direct inputs this plan builds on.

## Global Constraints

- **New field `salgssum Int?` on `Bolig`** — the realized sale price, set manually by an admin once the property sells. Nullable because most properties won't have sold yet. Like `kjopesum`, it is an internal-only field: it must be added to `SKRIVBARE_BOLIG_SKALARFELTER` in `lib/eiendom.ts` (so the existing `PUT /api/boliger/[id]` can write it) but **must never** be added to `OFFENTLIG_BOLIG_FELTER` in that same file — that constant is the allowlist the public website and public API routes select from, and leaking a sale price (or the pre-existing `kjopesum`) there would be the same class of bug `lib/eiendom.test.ts`'s existing "eksponerer ikke interne felt" test already guards `kjopesum`/`finansiering` against.
- **`kjopesum` and `salgssum` are both exposed as editable inputs in `BoligSkjema.tsx` for the first time in this plan.** They have been writable via the API since the Fundament phase (`kjopesum` is already in `SKRIVBARE_BOLIG_SKALARFELTER`) but the edit form never grew a field for them — this plan closes that gap because without it there is no way to enter the two numbers this whole feature needs. `kjopsdato`, `finansiering`, `estimertVerdiNa`, and `estimertVerdiEtterOppussing` have the same gap but are **not** required by this feature and are explicitly out of scope here — do not add inputs for them.
- **The two configurable percentages are a single system-wide setting, not per-eiendom.** The spec's own wording is "konfigurerbare verdier i systemet" (§7.6) — a company policy knob, unlike every other number in this feature (kjøpesum, salgssum, utgifter, kapitalinnskudd, timer) which §6 explicitly ties to a specific eiendom. This plan's own design call: one singleton `Innstilling` row (`id` fixed at `1`) holds `arbeidstimerAndelProsent` and `kapitalAndelProsent`, and every eiendom's fortjenestefordeling reads the same row.
- **The equal-split percentage is never stored — it is always `100 - arbeidstimerAndelProsent - kapitalAndelProsent`.** The spec's 80/10/10 always sums to 100; storing three numbers that must stay in sync invites drift, so only the two spec calls "configurable" are stored, and the remainder is derived.
- **Validation for the two stored percentages:** each must satisfy `0 <= verdi <= 100`, and `arbeidstimerAndelProsent + kapitalAndelProsent <= 100` (so the derived equal-split share never goes negative). Reject with a clear Norwegian message otherwise; never clamp silently.
- **Zero-denominator fallback: if nobody has logged any hours (or nobody has contributed any capital) on an eiendom, that pot's share is split equally among the eiere instead of being 0% for everyone.** Without this rule the corresponding slice of the fortjeneste would be computed as `fortjeneste * pctPot * 0% = 0` for every eier and silently vanish from the total each eier receives — which would make the breakdown fail to reconcile with the overall fortjeneste, directly contradicting §5's "a black box you can't verify by hand" failure mode. Note `beregnEierandeler` (pre-existing, reused as-is, not modified by this plan) already returns `andelProsent: 0` for every eier when the total capital is 0 — `beregnFortjenestefordeling` (this plan's own new function) must detect that zero-total case itself and substitute an equal split, for both the capital pot and the new hours pot.
- **Rounding is display-only.** `beregnFortjenestefordeling` returns exact (possibly fractional) `number` values — it must never round internally, so its own tests can assert exact arithmetic and so the sum of any eier's three components always equals the precise unrounded total. The one UI page that renders these values (Task 3) rounds each displayed figure to the nearest whole krone with `Math.round` purely for presentation and shows a one-line note ("Avrundet til nærmeste kr") rather than attempting penny-exact reconciliation of rounded display values — a "largest remainder" rounding scheme would be real added complexity this 4-person internal tool does not need, since the unrounded numbers (not the rounded display) are what's actually verifiable.
- **A negative `fortjeneste` (a loss) is a valid, expected input, not an error.** The same formula and the same split percentages apply — every term simply comes out negative. Do not special-case, clamp to zero, or reject a negative result anywhere in `lib/fortjeneste.ts`.
- **If `kjopesum` or `salgssum` is `null` on the Bolig, the fortjeneste cannot be computed at all.** `beregnFortjenestefordeling` returns a `{ beregnet: false; grunn: string }` sentinel in that case (see Task 2's exact type) rather than a nonsensical number (`null - 4000000`, `NaN`, etc.); the page (Task 3) must render that `grunn` as an explanatory message, not attempt to format `undefined` as currency.
- Any logged-in admin (the existing `getServerSession`/`authOptions` convention used by every sibling action in this codebase) may view the fortjeneste page and edit the `Innstilling` row — there is no role-based access control anywhere else in this codebase yet (§6 of the spec: "Fase 1-brukere er kun de fire eierne, alle med samme rolle/adgang"), so this plan does not invent one.
- **Any query that lists `AdminUser` rows for display must `select` only `{ id: true, navn: true }`** — same convention as every prior feature in this codebase (`app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx:38-42` is the cleanest existing example; do not copy `kapital/page.tsx:17`'s `findMany` with no `select`, which is a pre-existing minor the final review on the Utgifter plan already flagged and deliberately left unfixed — don't propagate it into new code).

## Review Focus

- Missing `salgssum` or `kjopesum` must produce a clear "not computable yet" message on the page, not a crash, `NaN`, or a silently-wrong number like treating a missing value as `0`.
- Zero total hours (or zero total capital) logged across all eiere for an eiendom must not divide by zero or produce `NaN` — it must fall back to an equal split for that pot (see Global Constraints), and the sum of all eiers' totals must still equal the overall fortjeneste.
- A negative fortjeneste (property sold at a loss) must still split correctly into three negative-flowing components per eier, not throw, not clamp to zero, and not flip sign.
- The two stored percentages must reject `arbeidstimerAndelProsent + kapitalAndelProsent > 100`, and reject either value being negative or over 100 individually — both boundary directions need a test, not just the "happy path" 10/10 default.
- `salgssum` (like the pre-existing `kjopesum`) must never appear in `OFFENTLIG_BOLIG_FELTER` or be returned by any public-facing route — a dedicated regression test for this, mirroring the existing `kjopesum`/`finansiering` test in `lib/eiendom.test.ts`, is required since this is exactly the kind of internal-field-leak class of bug a prior plan's review (Utgifter, finding UTG-03) already found once in this codebase.

---

### Task 1: `Bolig.salgssum`, the `Innstilling` model, and `lib/innstilling.ts`

**Files:**
- Modify: `prisma/schema.prisma` (add `salgssum Int?` to `Bolig`; add `model Innstilling`)
- Create: migration via `npx prisma migrate dev --name add_salgssum_og_innstilling`
- Create: `lib/innstilling.ts`
- Test: `lib/innstilling.test.ts`
- Modify: `lib/eiendom.ts` (add `"salgssum"` to `SKRIVBARE_BOLIG_SKALARFELTER`; do **not** touch `OFFENTLIG_BOLIG_FELTER`)
- Modify: `lib/eiendom.test.ts` (extend the existing "eksponerer ikke interne felt" test to also cover `salgssum`)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces (for Task 2 and Task 3):
  - `export const INNSTILLING_FEIL = "Ugyldig prosentfordeling.";`
  - `export async function hentInnstilling(prisma: PrismaClient): Promise<{ arbeidstimerAndelProsent: number; kapitalAndelProsent: number }>` — upserts the singleton row (`id: 1`) with defaults `{ arbeidstimerAndelProsent: 10, kapitalAndelProsent: 10 }` if it doesn't exist yet, then returns its two fields.
  - `export async function oppdaterInnstilling(prisma: PrismaClient, input: { arbeidstimerAndelProsent: number; kapitalAndelProsent: number }): Promise<void>` — validates both constraints below, throws `INNSTILLING_FEIL` on violation, otherwise upserts the singleton row.

- [ ] **Step 1: Add `salgssum` and the `Innstilling` model to `prisma/schema.prisma`**

Add `salgssum Int?` to `model Bolig`, directly below the existing `estimertVerdiEtterOppussing` field. Add:

```prisma
model Innstilling {
  id                       Int   @id @default(1)
  arbeidstimerAndelProsent Float @default(10)
  kapitalAndelProsent      Float @default(10)
}
```

No relation fields — this table is never joined, only ever read/written as a single row by `id: 1`.

- [ ] **Step 2: Run the migration and reconcile migration history**

Run: `npx prisma migrate dev --name add_salgssum_og_innstilling`

If this worktree hits the known migration-checksum-drift issue (seen on every `migrate dev` run in this workspace so far — see the fallback already documented and used twice in `lib/utgift.ts`'s own migration and the Kapitalinnskudd migration before it):
1. Apply the equivalent `ALTER TABLE Bolig ADD COLUMN salgssum INTEGER;` and `CREATE TABLE Innstilling (...)` SQL by hand against `dev.db` via `sqlite3`.
2. Write a migration file under `prisma/migrations/<timestamp>_add_salgssum_og_innstilling/migration.sql` with that exact SQL.
3. Record it as applied: `npx prisma migrate resolve --applied <timestamp>_add_salgssum_og_innstilling`.

Do not run `prisma migrate reset`. Then run `npx prisma generate`.

- [ ] **Step 3: Write failing tests in `lib/innstilling.test.ts`**

Using `createTestDb()` (the same real-SQLite helper every other `lib/*.test.ts` file in this codebase uses — see `lib/kapitalinnskudd.test.ts` for the exact import and setup pattern), cover:
- `hentInnstilling` on a fresh database (no `Innstilling` row exists yet) creates the row with the `{ 10, 10 }` defaults and returns them.
- `hentInnstilling` called a second time returns the same row unchanged (does not reset it back to defaults).
- `oppdaterInnstilling({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 })` persists, and a subsequent `hentInnstilling` returns `{ 15, 5 }`.
- `oppdaterInnstilling` with `arbeidstimerAndelProsent: 60, kapitalAndelProsent: 60` (sum 120, over 100) throws `INNSTILLING_FEIL` and does not change the stored row.
- `oppdaterInnstilling` with `arbeidstimerAndelProsent: -1, kapitalAndelProsent: 10` throws `INNSTILLING_FEIL`.
- `oppdaterInnstilling` with `arbeidstimerAndelProsent: 101, kapitalAndelProsent: 0` throws `INNSTILLING_FEIL`.
- `oppdaterInnstilling` with `arbeidstimerAndelProsent: 50, kapitalAndelProsent: 50` (sum exactly 100) succeeds — the boundary case is valid, not rejected.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/innstilling.test.ts`
Expected: FAIL (module `lib/innstilling.ts` does not exist yet).

- [ ] **Step 5: Implement `lib/innstilling.ts`**

`hentInnstilling`: `prisma.innstilling.upsert({ where: { id: 1 }, update: {}, create: { id: 1, arbeidstimerAndelProsent: 10, kapitalAndelProsent: 10 } })`, then return `{ arbeidstimerAndelProsent: rad.arbeidstimerAndelProsent, kapitalAndelProsent: rad.kapitalAndelProsent }`.

`oppdaterInnstilling`: validate `Number.isFinite` on both inputs, `0 <= verdi <= 100` for each, and `arbeidstimerAndelProsent + kapitalAndelProsent <= 100`; throw `new Error(INNSTILLING_FEIL)` on any violation before touching the database. On success: `prisma.innstilling.upsert({ where: { id: 1 }, update: input, create: { id: 1, ...input } })`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/innstilling.test.ts`
Expected: PASS

- [ ] **Step 7: Add `"salgssum"` to `SKRIVBARE_BOLIG_SKALARFELTER` in `lib/eiendom.ts`**

Add it to the existing array, alongside `kjopesum`. Do not add it to `OFFENTLIG_BOLIG_FELTER`.

- [ ] **Step 8: Extend the existing internal-field-leak test in `lib/eiendom.test.ts`**

Add `salgssum: 4500000` to the `prisma.bolig.create` call in the existing "eksponerer ikke interne felt som kjopesum eller finansiering" test, and add `expect(bolig).not.toHaveProperty("salgssum");` alongside the existing two assertions.

- [ ] **Step 9: Run the full suite and verify everything passes**

Run: `npx vitest run`
Expected: PASS (all prior tests plus the new ones)

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/innstilling.ts lib/innstilling.test.ts lib/eiendom.ts lib/eiendom.test.ts
git commit -m "feat: add Bolig.salgssum and configurable Innstilling percentages"
```

---

### Task 2: `lib/fortjeneste.ts` — the profit-split calculation

**Files:**
- Modify: `lib/utgift.ts` (add `beregnTotalUtgifter`)
- Modify: `lib/utgift.test.ts` (test the new export)
- Create: `lib/fortjeneste.ts`
- Test: `lib/fortjeneste.test.ts`

**Interfaces:**
- Consumes:
  - `beregnEierandeler(prisma: PrismaClient, eiendomId: number): Promise<Array<{ brukerId: number; brukerNavn: string; belop: number; andelProsent: number }>>` — pre-existing, from `lib/kapitalinnskudd.ts`, unmodified.
  - `hentInnstilling(prisma: PrismaClient): Promise<{ arbeidstimerAndelProsent: number; kapitalAndelProsent: number }>` — from Task 1.
- Produces (for Task 3):
  - `export async function beregnTotalUtgifter(prisma: PrismaClient, eiendomId: number): Promise<number>` (added to `lib/utgift.ts`) — sum of `belop` across every `Utgift` row for the eiendom (unlike `beregnFaktiskPerDelprosjekt`, this includes rows with `delprosjektId: null`); returns `0` if there are none.
  - `export async function beregnArbeidstimerAndeler(prisma: PrismaClient, eiendomId: number): Promise<Array<{ brukerId: number; brukerNavn: string; timer: number; andelProsent: number }>>` (in `lib/fortjeneste.ts`) — same shape and same zero-total behavior (`andelProsent: 0` for everyone when total hours is 0) as `beregnEierandeler`, but summing `Timeregistrering.antallTimer` joined through `delprosjekt.eiendomId === eiendomId`, restricted to `rolle: "eier"` admin users, for every eier (including ones with 0 hours).
  - The exact result type and `beregnFortjenestefordeling` function:

```ts
export type FortjenesteResultat =
  | { beregnet: false; grunn: string }
  | {
      beregnet: true;
      kjopesum: number;
      salgssum: number;
      totalUtgifter: number;
      fortjeneste: number;
      likedelProsent: number;
      arbeidstimerAndelProsent: number;
      kapitalAndelProsent: number;
      perEier: Array<{
        brukerId: number;
        brukerNavn: string;
        arbeidsandelProsent: number;
        kapitalandelProsent: number;
        likedel: number;
        arbeidsdel: number;
        kapitaldel: number;
        totalt: number;
      }>;
    };

export async function beregnFortjenestefordeling(
  prisma: PrismaClient,
  eiendomId: number
): Promise<FortjenesteResultat>
```

- [ ] **Step 1: Write a failing test for `beregnTotalUtgifter` in `lib/utgift.test.ts`**

Add a test asserting it sums `belop` across multiple `Utgift` rows **including** ones with `delprosjektId: null`, and returns `0` for an eiendom with no `Utgift` rows at all. Follow the existing `opprettEiendom` test helper already in that file.

- [ ] **Step 2: Run it to verify it fails, then implement `beregnTotalUtgifter` in `lib/utgift.ts`**

Run: `npx vitest run lib/utgift.test.ts`
Expected: FAIL, then implement with `prisma.utgift.aggregate({ where: { eiendomId }, _sum: { belop: true } })`, returning `resultat._sum.belop ?? 0`. Re-run to verify it passes.

- [ ] **Step 3: Write failing tests in `lib/fortjeneste.test.ts` for `beregnArbeidstimerAndeler`**

Using `createTestDb()`, mirror `lib/kapitalinnskudd.test.ts`'s `beregnEierandeler` tests exactly but with `Timeregistrering` rows against a `Delprosjekt` belonging to the eiendom:
- Two eiere log different hours on delprosjekter under the same eiendom → `andelProsent` reflects each one's share of the total, and every eier with `rolle: "eier"` appears even if they logged 0 hours.
- No `Timeregistrering` rows at all for the eiendom → every eier's `andelProsent` is `0` (not `NaN`, not divide-by-zero) — this zero-total case is the raw aggregate's job; the equal-split *fallback* for this case belongs to `beregnFortjenestefordeling`, tested separately below.

- [ ] **Step 4: Run to verify failure, then implement `beregnArbeidstimerAndeler`**

Run: `npx vitest run lib/fortjeneste.test.ts`
Expected: FAIL (module doesn't exist). Implement following the exact structure of `beregnEierandeler` in `lib/kapitalinnskudd.ts` (same eier-fetch, same zero-total guard, same sort), replacing the `Kapitalinnskudd` query with a `Timeregistrering` query filtered by `delprosjekt: { eiendomId }` and grouped by `brukerId`, restricted to `brukerId`s that are `rolle: "eier"`.

- [ ] **Step 5: Write failing tests in `lib/fortjeneste.test.ts` for `beregnFortjenestefordeling`**

Using `createTestDb()`, set up an eiendom with `kjopesum`/`salgssum`, some `Kapitalinnskudd`, `Timeregistrering`, and `Utgift` rows across 2-4 `rolle: "eier"` AdminUsers, and cover:
- **Missing data:** `salgssum: null` (or `kjopesum: null`) → returns `{ beregnet: false, grunn: <non-empty string> }`.
- **Hand-computed happy path:** pick simple round numbers (e.g. `kjopesum: 1_000_000`, `salgssum: 1_500_000`, total utgifter `100_000` → `fortjeneste: 400_000`; two eiere with capital shares `75%`/`25%` and hour shares `40%`/`60%`; `Innstilling` left at the `10/10` default so `likedelProsent: 80`) and assert every field of the result — including that `perEier` sums to exactly `400_000` across its `totalt` values — matches the number you compute by hand in the test itself.
- **Negative fortjeneste:** `salgssum < kjopesum + totalUtgifter` → `fortjeneste` is negative, and each eier's three components and `totalt` come out negative in the same proportions as the positive case (no clamping, no sign flip, no thrown error).
- **Zero-hours fallback:** no `Timeregistrering` rows at all for the eiendom → every eier's `arbeidsandelProsent` in the result is `100 / antallEiere` (equal split), not `0` — and the sum of `perEier[i].totalt` still equals the overall `fortjeneste` exactly.
- **Zero-capital fallback:** same as above but for `Kapitalinnskudd` and `kapitalandelProsent`.
- **Custom `Innstilling`:** with `arbeidstimerAndelProsent: 20, kapitalAndelProsent: 5` persisted via `oppdaterInnstilling`, `likedelProsent` in the result is `75`, and the weighted components reflect the new percentages.

- [ ] **Step 6: Run to verify failure, then implement `beregnFortjenestefordeling`**

Run: `npx vitest run lib/fortjeneste.test.ts`
Expected: FAIL. Implement:
1. Fetch the Bolig (`select: { kjopesum: true, salgssum: true }`); if either is `null` or the Bolig doesn't exist, return `{ beregnet: false, grunn: "..." }` with a clear Norwegian message (distinguish "fant ikke eiendommen" from "kjøpesum/salgssum er ikke satt").
2. Call `beregnTotalUtgifter`, `beregnEierandeler`, `beregnArbeidstimerAndeler`, `hentInnstilling` (all already built).
3. Compute `fortjeneste = salgssum - kjopesum - totalUtgifter`, `likedelProsent = 100 - arbeidstimerAndelProsent - kapitalAndelProsent`.
4. For each eier (the union driven by `beregnEierandeler`'s own eier list, which already enumerates every `rolle: "eier"` row): determine `kapitalandelProsent` and `arbeidsandelProsent`, substituting `100 / antallEiere` for either one when its underlying total is zero (detect this by checking whether every eier's raw `andelProsent`/`andelProsent` from the two aggregates is `0` **and** the total across all eiere of the underlying `belop`/`timer` is `0` — not just because one eier happens to have 0).
5. Compute `likedel = fortjeneste * (likedelProsent / 100) / antallEiere`, `arbeidsdel = fortjeneste * (arbeidstimerAndelProsent / 100) * (arbeidsandelProsent / 100)`, `kapitaldel = fortjeneste * (kapitalAndelProsent / 100) * (kapitalandelProsent / 100)`, `totalt = likedel + arbeidsdel + kapitaldel`.
6. Return the full `FortjenesteResultat`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run lib/fortjeneste.test.ts lib/utgift.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add lib/utgift.ts lib/utgift.test.ts lib/fortjeneste.ts lib/fortjeneste.test.ts
git commit -m "feat: add fortjenestefordeling calculation"
```

---

### Task 3: Settings page, Fortjeneste page, and BoligSkjema inputs

**Files:**
- Create: `app/admin/(protected)/innstillinger/page.tsx`
- Create: `app/admin/(protected)/innstillinger/actions.ts`
- Test: `app/admin/(protected)/innstillinger/actions.test.ts`
- Create: `app/admin/(protected)/innstillinger/InnstillingerForm.tsx`
- Create: `app/admin/(protected)/boliger/[id]/fortjeneste/page.tsx`
- Modify: `components/admin/BoligSkjema.tsx` (add `kjopesum`/`salgssum` inputs)
- Modify: `app/admin/(protected)/boliger/[id]/page.tsx` (pass new initial values; add nav link)
- Modify: `app/admin/(protected)/boliger/[id]/kapital/page.tsx` (add nav link)
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx` (add nav link)
- Modify: `app/admin/(protected)/AdminNavbar.tsx` (add top-level "Innstillinger" link)

**Interfaces:**
- Consumes: `hentInnstilling`/`oppdaterInnstilling`/`INNSTILLING_FEIL` (Task 1), `beregnFortjenestefordeling`/`FortjenesteResultat` (Task 2).
- Produces: nothing consumed by an earlier task (this is the last task).

- [ ] **Step 1: Write a failing test for `oppdaterInnstillingAction` in `app/admin/(protected)/innstillinger/actions.test.ts`**

Follow the exact `vi.hoisted` prisma-mock pattern in `app/admin/(protected)/boliger/[id]/kapital/actions.test.ts` (mock `@/lib/prisma`'s default export, mock `next-auth`'s `getServerSession`). Cover:
- No session → the action throws `"Ikke autorisert."`.
- Valid input (`{ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 }`) with a session → calls the lib's `oppdaterInnstilling` and returns `{ ok: true, data: null }`.
- The lib throwing `INNSTILLING_FEIL` (sum over 100) → returns `{ ok: false, feilmelding: INNSTILLING_FEIL }`, not an uncaught throw.
- An unexpected error from the lib → returns `{ ok: false, feilmelding: "Noe gikk galt. Prøv igjen." }` (the existing generic-fallback convention from `slettInnskuddAction`).

- [ ] **Step 2: Run to verify failure, then implement `app/admin/(protected)/innstillinger/actions.ts`**

Run: `npx vitest run app/admin/\(protected\)/innstillinger/actions.test.ts`
Expected: FAIL. Implement `oppdaterInnstillingAction(input: { arbeidstimerAndelProsent: number; kapitalAndelProsent: number }): Promise<HandlingResultat<null>>` following `slettInnskuddAction`'s exact try/catch structure (session check throws `"Ikke autorisert."` the same way; catch `err.message === INNSTILLING_FEIL` and pass it through; generic fallback otherwise). Define `HandlingResultat<T>` locally the same way `kapital/actions.ts` does, or import/reuse it if a shared location already exists — check before duplicating.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run app/admin/\(protected\)/innstillinger/actions.test.ts`
Expected: PASS

- [ ] **Step 4: Build `app/admin/(protected)/innstillinger/InnstillingerForm.tsx`**

A small `"use client"` form (two number inputs: "Arbeidstimer-andel (%)" and "Kapitalandel (%)", pre-filled from `initial` props) that calls `oppdaterInnstillingAction` on submit, shows the returned `feilmelding` on failure, and calls `router.refresh()` on success — same shape as `KapitalPanel.tsx`'s submit handling, minus the list-of-entries part (this form only ever edits one row).

- [ ] **Step 5: Build `app/admin/(protected)/innstillinger/page.tsx`**

Server component: `const innstilling = await hentInnstilling(prisma);`, render a heading ("Innstillinger") and `<InnstillingerForm initial={innstilling} />`. Add `export const dynamic = "force-dynamic";` matching every sibling page.

- [ ] **Step 6: Build `app/admin/(protected)/boliger/[id]/fortjeneste/page.tsx`**

Server component: fetch the Bolig (404 via `notFound()` if missing, matching `kapital/page.tsx`), call `const resultat = await beregnFortjenestefordeling(prisma, eiendomId);`.

If `!resultat.beregnet`: render the `resultat.grunn` message in a plain info box (no table).

If `resultat.beregnet`: render, in order: a summary block showing `kjopesum`, `salgssum`, `totalUtgifter`, and `fortjeneste` (each via `new Intl.NumberFormat("nb-NO").format(Math.round(verdi))` + " kr", fortjeneste visually emphasized, and a loss shown with a minus sign the formatter already produces — no special-casing needed); then a table with one row per `perEier` entry showing `brukerNavn`, `arbeidsandelProsent`/`kapitalandelProsent` (as `%` to one decimal, e.g. `rad.arbeidsandelProsent.toFixed(1)`), and `likedel`/`arbeidsdel`/`kapitaldel`/`totalt` each rounded the same way as the summary block; a one-line note below the table: "Avrundet til nærmeste kr." Add nav links matching the existing header pattern (back to the bolig, across to Delprosjekter and Kapital) plus a link to `/admin/innstillinger` labeled "Juster fordelingsnøkkel".

- [ ] **Step 7: Add `kjopesum`/`salgssum` inputs to `BoligSkjema.tsx`**

Add `kjopesum: string` and `salgssum: string` to the `BoligData` interface and the `useState` initializer (`initial?.kjopesum?.toString() ?? ""`, same pattern as `pris`). Add a new section between "Detaljer" and "Bilder" titled "Økonomi (internt)" with two number inputs ("Kjøpesum (kr)", "Salgssum (kr)"), each with a one-line note that this is internal-only and never shown on the public site. In `handleSubmit`'s `payload`, add `kjopesum: form.kjopesum ? parseInt(form.kjopesum) : null` and `salgssum: form.salgssum ? parseInt(form.salgssum) : null`, same pattern as `pris`.

- [ ] **Step 8: Wire `kjopesum`/`salgssum` through the edit page and add nav links**

In `app/admin/(protected)/boliger/[id]/page.tsx`, add `kjopesum: bolig.kjopesum?.toString() ?? ""` and `salgssum: bolig.salgssum?.toString() ?? ""` to the `initial` prop passed to `BoligSkjema`, and add a `Fortjeneste` nav link alongside the existing `Delprosjekter`/`Kapital` links (same `Link` pattern). Add the same `Fortjeneste` link to the header nav blocks in `kapital/page.tsx` and `delprosjekter/page.tsx`. Add an "Innstillinger" top-level link to `AdminNavbar.tsx`, following the existing `Dashboard`/`Boliger`/`Henvendelser` link pattern exactly (including the `pathname.startsWith(...)` active-state check).

- [ ] **Step 9: Manual verification**

Start the dev server if not already running. Log in, open a Bolig's edit page, enter a `kjopesum` and `salgssum`, save. Open its new Fortjeneste page and confirm the breakdown renders with sensible numbers that sum correctly by hand against the shown `fortjeneste`. Open Innstillinger, change a percentage, save, and confirm the Fortjeneste page's split updates accordingly. Confirm a Bolig with no `salgssum` set shows the "not computable" message instead of a broken number.

- [ ] **Step 10: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 11: Typecheck**

Run: `npx tsc --noEmit` (or the project's existing typecheck script)
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add app/admin/\(protected\)/innstillinger app/admin/\(protected\)/boliger/\[id\]/fortjeneste components/admin/BoligSkjema.tsx app/admin/\(protected\)/boliger/\[id\]/page.tsx app/admin/\(protected\)/boliger/\[id\]/kapital/page.tsx app/admin/\(protected\)/boliger/\[id\]/delprosjekter/page.tsx app/admin/\(protected\)/AdminNavbar.tsx
git commit -m "feat: add fortjeneste page, innstillinger settings, and kjopesum/salgssum inputs"
```
