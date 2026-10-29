# Selskaps-dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing admin dashboard (`/admin`) with a company-wide aggregated view across all eiendommer per spec §7.9: total capital invested, total expenses this calendar month, expense and budget-vs-actual per property, and upcoming work events from the calendar — replacing "nobody has the whole picture, it's scattered across each property's own pages" with one landing-page overview. This is the last module in the current build round (spec §7.1–7.9 all covered after this).

**Architecture:** No new Prisma model — this feature is pure read-side aggregation over models that already exist (`Bolig`, `Delprosjekt`, `Kapitalinnskudd`, `Utgift`, `Arbeidshendelse`), all built in earlier phases of this same branch. A new `lib/dashboard.ts` holds the cross-eiendom aggregation queries (the one genuinely new category of query this feature needs — every existing `lib/*.ts` aggregation function, like `beregnTotalUtgifter`, is scoped to a single `eiendomId`, and none of them answer "across every property"). `lib/arbeidshendelse.ts` gets one additional function for "upcoming events across all properties," extending the file Kalender's Task 1 already built rather than duplicating its query shape. The existing `app/admin/(protected)/page.tsx` (`AdminDashboard`) is extended in place, not replaced — it already shows property counts (satisfying §7.9's "antall eiendommer" bullet) and a recent-properties list; this plan adds three new sections below/alongside those: financial stat cards, a per-property budget/expense table, and an upcoming-activities list.

**Tech Stack:** Next.js 16 App Router Server Component (no new server actions or routes — this feature has no mutations, it's read-only), Prisma 7 (libsql/SQLite) `aggregate`/`groupBy`, Vitest + `createTestDb()` for `lib/dashboard.ts`.

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` §7.9 (Selskaps-dashboard): "Aggregert oversikt: antall eiendommer, totale investeringer, totale utgifter denne måneden, utgift per eiendom, budsjett vs. faktisk per eiendom, kommende aktiviteter fra kalenderen." "Antall eiendommer" is already satisfied by the existing dashboard's "Totalt boliger" stat card — this plan covers the other five bullets.

## Global Constraints

- **"Totale investeringer" means the sum of all `Kapitalinnskudd.belop` across every eiendom** — the capital the four owners have actually put in, matching this codebase's own term for that concept everywhere else (`Kapitalinnskudd`, "kapitalinnskudd", `beregnEierandeler`). It is not `Bolig.kjopesum`/`estimertVerdiNa` (those describe a property's price/valuation, a different number entirely, and summing them across properties would double-count money that was itself funded by the same capital contributions).
- **"Totale utgifter denne måneden" is a calendar-month boundary in Europe/Oslo, computed the same way the Kalender feature's final review already validated**, not a naive `Date` comparison: get today's Oslo date via `new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date())`, take its year/month, and build `manedStart = new Date(Date.UTC(year, month - 1, 1))` / `manedSluttEksklusiv = new Date(Date.UTC(year, month, 1))` (first-of-next-month, exclusive upper bound). Query with `dato: { gte: manedStart, lt: manedSluttEksklusiv }`. This matches the UTC-midnight storage convention every `dato` field in this codebase already uses (every action validates and stores a date string as `new Date(\`${dato}T00:00:00.000Z\`)`), so comparing against UTC-midnight month boundaries is correct and consistent — not a new convention, the same one already proven on the Kalender branch.
- **"Utgift per eiendom" and "budsjett vs. faktisk per eiendom" are the same underlying per-property data, shown together, not two separate queries.** For each `Bolig`, the plan computes `totalUtgift` (all `Utgift.belop` for that eiendom, all-time — this number alone *is* "utgift per eiendom") and `totalBudsjett` (sum of that eiendom's `Delprosjekt.budsjett`, over only the delprosjekt rows with a non-null budget). Displaying `totalUtgift` next to `totalBudsjett` *is* the budget-vs-actual view the spec asks for — mirror the existing per-delprosjekt page's plain `"{faktisk} / {budsjett} kr"` display convention (`app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx:101-102`) rather than inventing a new progress-bar/percentage visual this codebase doesn't otherwise use.
- **"No budget set" must be distinguishable from both "zero delprosjekter exist" AND "a budget was explicitly set to 0 kr"** — `Delprosjekt.budsjett` is an optional `Int?` that this codebase's own creation form (`NyttDelprosjektSkjema.tsx`) allows leaving blank (→ `undefined`/`null`) or typing `0` into (→ an explicit, meaningful zero, e.g. "this sub-project gets no separate budget by agreement"). A single `totalBudsjett: number` + `fulltBudsjettert: boolean` pair cannot carry this distinction — a `null`-budget delprosjekt and a zero-delprosjekter eiendom both collapse to the same `totalBudsjett: 0`. The aggregation must instead carry two counts per eiendom: `antallDelprosjekter` (total delprosjekter on that eiendom) and `antallMedBudsjett` (how many of those have a non-null, i.e. explicitly set, `budsjett`). The UI derives display state purely from these counts: `antallMedBudsjett === 0` → "Ikke budsjettert" (covers both the zero-delprosjekter and the all-null-budget case); otherwise show the `totalBudsjett` sum, additionally marked "(delvis)" when `antallMedBudsjett < antallDelprosjekter`.
- **This aggregation must cover every `Bolig`, including one with zero delprosjekter/utgifter/kapitalinnskudd** (a brand-new property added today) — it must show up with zeros, not be silently absent from the table. Build the per-property result by starting from `prisma.bolig.findMany` (every property) and left-joining in-memory `Map`s built from `groupBy` aggregates, never by starting from `groupBy` results alone (which would omit properties with no rows in the grouped table).
- **"Kommende aktiviteter fra kalenderen" means upcoming `Arbeidshendelse` rows only** (work events), not `Tilgjengelighet` (availability marks) — "aktiviteter" (activities) is this codebase's own word for `Arbeidshendelse` specifically; availability isn't an activity. Scope: `dato >= today` (Europe/Oslo, same date-key convention as above), ordered ascending, capped at a fixed small number (5) so the dashboard stays a landing page, not a second calendar.
- No role-based filtering anywhere in this feature — any logged-in admin sees the whole company's aggregated numbers across every property, consistent with every other feature in this codebase (spec §6: all four owners have the same access).
- NOK formatting via the existing `Intl.NumberFormat("nb-NO")` convention already used on the delprosjekter page — reuse that exact call, don't introduce a different number-formatting helper.

## Review Focus

Points to scrutinize in the Codex review round(s) before implementation (log in `2026-10-28-selskaps-dashboard-REVIEW-LOG.md`):

- The month-boundary computation for "totale utgifter denne måneden" must actually use the UTC-midnight-of-Oslo-date convention described above, not a timezone-naive `new Date()` comparison — this exact class of bug has already bitten this codebase twice (a documented Dokument `opprettet` display fix, and a validated fix on the Kalender branch).
- The per-property aggregation must include every `Bolig`, not just ones with at least one `Delprosjekt`/`Utgift`/`Kapitalinnskudd` row — verify the "starts from `Bolig.findMany`, left-joins via Map" approach is actually followed, not a `groupBy`-only approach that would silently drop empty properties.
- `antallDelprosjekter`/`antallMedBudsjett` must actually let the UI tell apart three distinct states: zero delprosjekter, one-or-more delprosjekter all with `budsjett: null`, and a delprosjekt with an explicit `budsjett: 0` — confirm the plan's test coverage (Task 1 Step 5) exercises all three, not just the null-vs-populated case.
- "Totale investeringer" must sum `Kapitalinnskudd.belop`, never any `Bolig` price/valuation field — a mix-up here would silently produce a company-wide number that's wrong by an order of magnitude.
- The upcoming-activities list's date-key comparison ("is this event today or later") must use the same Europe/Oslo convention as the month boundary — an event dated "today" in Oslo time must not be excluded by a UTC-day-boundary mismatch.

---

## Task 1: `lib/dashboard.ts` aggregation functions + `hentKommendeArbeidshendelser`

**Files:**
- Create: `lib/dashboard.ts`, `lib/dashboard.test.ts`
- Modify: `lib/arbeidshendelse.ts` (add one function)
- Modify: `lib/arbeidshendelse.test.ts` (add its tests)

**Interfaces:**
- Consumes: nothing new — reads existing `Bolig`, `Delprosjekt`, `Kapitalinnskudd`, `Utgift` tables via Prisma directly.
- Produces (for Task 2):
  - `export function manedsgrenserOslo(naa?: Date): { start: Date; sluttEksklusiv: Date }` — pure function (no Prisma), takes an optional "now" override for testability, returns the current Europe/Oslo calendar month's UTC-midnight boundaries per the Global Constraints formula above. Defaults `naa` to `new Date()`.
  - `export async function hentTotalInvestert(prisma: PrismaClient): Promise<number>` — `prisma.kapitalinnskudd.aggregate({ _sum: { belop: true } })`, returns `._sum.belop ?? 0`.
  - `export async function hentTotalUtgifterDenneManeden(prisma: PrismaClient, naa?: Date): Promise<number>` — uses `manedsgrenserOslo(naa)` for the `where: { dato: { gte, lt } }` clause on `prisma.utgift.aggregate`, returns `._sum.belop ?? 0`.
  - `export type EiendomOversiktRad = { id: number; tittel: string; totalUtgift: number; totalBudsjett: number; antallDelprosjekter: number; antallMedBudsjett: number };`
  - `export async function hentEiendomOversikt(prisma: PrismaClient): Promise<EiendomOversiktRad[]>` — per the Global Constraints: start from `prisma.bolig.findMany({ select: { id: true, tittel: true }, orderBy: { tittel: "asc" } })`; separately `groupBy` on `utgift` (`by: ["eiendomId"], _sum: { belop: true }`) into a `Map<number, number>`; separately `findMany` on `delprosjekt` (`select: { eiendomId: true, budsjett: true }`) and reduce in-memory, per `eiendomId`, into `totalBudsjett` (sum of non-null `budsjett` values only), `antallDelprosjekter` (count of all rows for that eiendom, regardless of budget), and `antallMedBudsjett` (count of rows with a non-null `budsjett` — this is what distinguishes "no delprosjekt" and "delprosjekt with no budget set" from "delprosjekt with an explicit `budsjett: 0`", since a `0` is non-null and increments this count while contributing `0` to the sum). Merge all three sources into `EiendomOversiktRad[]`, one row per `Bolig`, defaulting any eiendom missing from a map to `0` for all four numeric fields.
  - In `lib/arbeidshendelse.ts`: `export async function hentKommendeArbeidshendelser(prisma: PrismaClient, fraDato: Date, antall: number): Promise<Array<{ id: number; eiendomId: number; eiendomTittel: string; tittel: string; dato: Date }>>` — `findMany({ where: { dato: { gte: fraDato } }, orderBy: { dato: "asc" }, take: antall, include: { eiendom: { select: { tittel: true } } } })`, mapped to the flat shape (same `eiendomTittel` join pattern `hentArbeidshendelserForPeriode` already uses in this file).

- [ ] **Step 1: Write failing tests for `manedsgrenserOslo` and `hentTotalInvestert`/`hentTotalUtgifterDenneManeden` in `lib/dashboard.test.ts`**

Using `createTestDb()` (per `tests/helpers/testDb.ts`), cover:
- `manedsgrenserOslo(new Date("2026-11-15T12:00:00.000Z"))` returns `{ start: new Date("2026-11-01T00:00:00.000Z"), sluttEksklusiv: new Date("2026-12-01T00:00:00.000Z") }`.
- `manedsgrenserOslo(new Date("2026-12-31T20:00:00.000Z"))` (20:00 UTC = 21:00 Oslo on Dec 31, still December in Oslo) returns `{ start: new Date("2026-12-01T00:00:00.000Z"), sluttEksklusiv: new Date("2027-01-01T00:00:00.000Z") }`.
- `manedsgrenserOslo(new Date("2026-12-31T23:30:00.000Z"))` (23:30 UTC = 00:30 Oslo on **Jan 1** — Oslo is UTC+1 in winter, so this instant is already the next day/month/year in Oslo even though it's still Dec 31 in UTC) returns `{ start: new Date("2027-01-01T00:00:00.000Z"), sluttEksklusiv: new Date("2027-02-01T00:00:00.000Z") }` — this is the test that actually proves the function uses the Oslo calendar date, not the UTC one; a naive UTC-month implementation would wrongly return December boundaries here.
- `hentTotalInvestert` with `Kapitalinnskudd` rows across two different eiendommer sums all of them; with none, returns `0`.
- `hentTotalUtgifterDenneManeden`, given one `Utgift` dated inside the passed `naa`'s month and one dated the month before, sums only the in-month one; with none in range, returns `0`. Use the function's `naa` override to make this deterministic (don't depend on the real current date in a test).

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run lib/dashboard.test.ts`
Expected: FAIL (module does not exist yet).

- [ ] **Step 3: Implement `manedsgrenserOslo`, `hentTotalInvestert`, `hentTotalUtgifterDenneManeden` in `lib/dashboard.ts`**

Per the Interfaces block above.

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run lib/dashboard.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `hentEiendomOversikt`**

Add to `lib/dashboard.test.ts`, covering every budget-state the Global Constraints distinguish:
- Four `Bolig` rows: (a) one delprosjekt with a budget set, plus `Utgift` rows; (b) one delprosjekt with `budsjett: null` and no utgifter; (c) zero delprosjekter; (d) one delprosjekt with an explicit `budsjett: 0`. `hentEiendomOversikt` returns exactly 4 rows (one per `Bolig`), each with correct `totalUtgift`/`totalBudsjett`/`antallDelprosjekter`/`antallMedBudsjett`.
- (a) has `antallDelprosjekter: 1`, `antallMedBudsjett: 1`, `totalBudsjett` equal to the set value.
- (b) has `antallDelprosjekter: 1`, `antallMedBudsjett: 0`, `totalBudsjett: 0` (the null row excluded from the sum, not counted as a zero).
- (c) has `antallDelprosjekter: 0`, `antallMedBudsjett: 0`, `totalBudsjett: 0`.
- (d) has `antallDelprosjekter: 1`, `antallMedBudsjett: 1`, `totalBudsjett: 0` — same numeric totals as (b) and (c), but distinguishable from both via `antallMedBudsjett` (1 here, 0 for the other two) — this is the specific case DASH-002/DASH-003 (this plan's own Codex review) caught as unrepresentable in an earlier draft.
- A fifth eiendom with two delprosjekter, one budgeted and one not, has `antallDelprosjekter: 2`, `antallMedBudsjett: 1`, `totalBudsjett` equal to only the budgeted one's value.

- [ ] **Step 6: Run to verify failure, implement, run again to verify pass**

Run: `npx vitest run lib/dashboard.test.ts`
Expected: PASS (all tests, this file).

- [ ] **Step 7: Write failing tests for `hentKommendeArbeidshendelser` in `lib/arbeidshendelse.test.ts`**

Add: given events dated before, on, and after a reference `fraDato`, returns only the on-or-after ones, ascending by `dato`, each with the correct `eiendomTittel`; respects `antall` (create more matching events than the passed `antall` and confirm the result is capped and still the earliest ones).

- [ ] **Step 8: Run to verify failure, implement, run again to verify pass**

Run: `npx vitest run lib/arbeidshendelse.test.ts`
Expected: PASS

- [ ] **Step 9: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add lib/dashboard.ts lib/dashboard.test.ts lib/arbeidshendelse.ts lib/arbeidshendelse.test.ts
git commit -m "feat: add cross-eiendom dashboard aggregation functions"
```

---

## Task 2: Extend `/admin` dashboard page with company-wide sections

**Files:**
- Modify: `app/admin/(protected)/page.tsx`

**Interfaces:**
- Consumes: everything Task 1 exports from `lib/dashboard.ts` and `hentKommendeArbeidshendelser` from `lib/arbeidshendelse.ts`.
- Produces: nothing new (this is the final consumer — no further task depends on it).

- [ ] **Step 1: Fetch the new data in `AdminDashboard`**

Add to the existing `Promise.all`/sequential fetch block: `hentTotalInvestert(prisma)`, `hentTotalUtgifterDenneManeden(prisma)`, `hentEiendomOversikt(prisma)`, and `hentKommendeArbeidshendelser(prisma, <today's Oslo date as a UTC-midnight Date>, 5)`. Derive "today" the same way `manedsgrenserOslo`'s own internal logic does (Europe/Oslo date-key → UTC midnight `Date`) — don't introduce a third ad hoc date-computation idiom in this file; either export a small today-helper from `lib/dashboard.ts` in Task 1 (preferred, keeps the Oslo-date logic in one tested place) or inline the exact same `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" })` → `new Date(\`${key}T00:00:00.000Z\`)` pattern used elsewhere in this codebase.

- [ ] **Step 2: Add two new stat cards to the existing stat grid**

Extend the existing `{ label, verdi, farge }` array (the one currently rendering "Totalt boliger"/"Til salgs"/"Til leie"/"Synlig offentlig") with "Totalt investert" (NOK-formatted via `Intl.NumberFormat("nb-NO")`) and "Utgifter denne måneden" (same formatting). This may mean widening the grid from 4 to 6 cards or wrapping to a second row — follow whatever `grid-cols` adjustment keeps all 6 readable at the existing breakpoints (`grid-cols-2 lg:grid-cols-4` → likely `grid-cols-2 lg:grid-cols-3` for 6 cards, or `lg:grid-cols-6` if that stays legible — use judgment, this is a layout detail the plan doesn't need to lock down further).

- [ ] **Step 3: Add a per-property budget/expense table section**

New section (same `bg-white rounded-xl border` card style as "Siste boliger"), one row per `hentEiendomOversikt` result: property title (linking to `/admin/boliger/{id}`), "{totalUtgift formatted} kr" and, next to it, the budget side derived purely from the two counts per the Global Constraints: `antallMedBudsjett === 0` → "Ikke budsjettert" (covers both zero-delprosjekter and all-null-budget eiendommer); otherwise "{totalBudsjett formatted} kr", with a muted "(delvis)" suffix appended when `antallMedBudsjett < antallDelprosjekter`. Mirror the plain `"{faktisk} / {budsjett} kr"` display convention from the delprosjekter page (no progress bars/percentages).

- [ ] **Step 4: Add an upcoming-activities section**

New section, same card style, listing the (up to 5) `hentKommendeArbeidshendelser` results: date (formatted `dd.mm.yyyy` per this codebase's Norwegian-date convention), title, property name (linking to `/admin/boliger/{eiendomId}`), with a "Se kalenderen" link to `/admin/kalender` either in the section header or as an empty-state call-to-action when there are zero upcoming events (mirror the existing "Ingen boliger ennå... Opprett den første!" empty-state pattern already in this file).

- [ ] **Step 5: Manual verification (human partner)**

Page components in this codebase aren't unit-tested, and this worktree's established pattern is that login/browser-based manual checks are done by the human partner, not worked around in-session. Ask them to: log in, open `/admin`, confirm the new stat cards show sensible numbers, confirm the per-property table includes a property with no delprosjekter (shows "Ikke budsjettert", not a crash or a 0/0), and confirm the upcoming-activities list shows events created during the Kalender phase (or its empty state, if none are upcoming).

- [ ] **Step 6: Run the full suite one more time**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "app/admin/(protected)/page.tsx"
git commit -m "feat: add company-wide aggregates to admin dashboard"
```

---

## Final whole-branch review

After both tasks are committed, review across the whole feature together, covering every Review Focus point above, plus: does the dashboard page's own data-fetching introduce any N+1 query pattern that `hentEiendomOversikt`'s Map-based approach was specifically designed to avoid (verify Task 2 didn't accidentally re-introduce a per-eiendom loop calling a per-eiendom lib function instead of using the batch result).
