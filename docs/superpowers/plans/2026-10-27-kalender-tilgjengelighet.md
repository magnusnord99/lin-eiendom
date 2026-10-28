# Kalender & tilgjengelighet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four owners a shared calendar where each marks their own available/unavailable days (with optional time intervals and a bounded weekly-recurring pattern), see a month or week view color-coded per person, and quickly spot which upcoming days have the most owners free at once — replacing the "ask in Messenger" status quo per the spec (§7.8). Also let any admin create a simple work event tied to a specific eiendom, visible on the same calendar.

**Architecture:** Two new, independent Prisma models: `Tilgjengelighet` (one row per `(brukerId, dato)`, upserted — marking a day you already marked overwrites it rather than erroring or duplicating) and `Arbeidshendelse` (a simple event tied to one `Bolig`). A weekly-recurring pattern is **materialized** at creation time into up to 26 concrete `Tilgjengelighet` rows sharing one `gjentakelseId` — not stored as an abstract rule expanded at render time — matching this codebase's existing preference for simple, directly-queryable rows over calendar-math abstractions, and bounding how many rows one request can create. The calendar itself is a new top-level page (`/admin/kalender`), not nested under a `Bolig`, because availability is inherently cross-property and shared — the same reason `Henvendelser`/`Innstillinger` are top-level today. `Arbeidshendelse` still requires picking an eiendom from a dropdown on the shared page, the same way `Utgift`'s `betaltAvBrukerId` is picked from a list without needing to *be* that page. Overlap-highlighting ("which day has the most people free") is a pure, tested `lib` function operating on one month's already-fetched rows — never a per-day database round trip.

**Tech Stack:** Next.js 16 App Router Server Components + Server Actions (no new route handlers — no binary data here, unlike Dokumenter), Prisma 7 (libsql/SQLite), Vitest + `createTestDb()` for both new `lib/*.ts` modules.

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` §7.8 (Kalender & tilgjengelighet): "Hver eier markerer ledige/ikke-ledige dager (inkl. tidsintervaller og gjentakende mønster). Kalendervisning (måned/uke) med fargekoding, og en visning som fremhever dager hvor flest har overlappende tilgjengelighet. Enkle arbeidshendelser kan opprettes og knyttes til en eiendom." §9 defers exact fields/validation and the month-vs-week layout to the plan phase — this plan makes those calls below.

## Global Constraints

- **Weekly recurrence is materialized into concrete rows at creation time, capped at 26 occurrences (~6 months), not stored as an RRULE and expanded at render time.** Each generated row shares one `gjentakelseId` (a `crypto.randomUUID()` string) for future reference, but this plan does not build batch-edit/batch-delete-the-series — each row is deleted individually like any other, same as a non-recurring one. Flag batch-series-delete as a known, deliberately out-of-scope gap for the human partner, not something to build around.
- **`Tilgjengelighet` is self-only — this is a deliberate exception to this codebase's otherwise universal "any admin may touch any record" rule** (which `Utgift`, `Dokument`, and `Kapitalinnskudd` all follow). Create always takes `brukerId` from the session, never from client input. Delete uses `prisma.tilgjengelighet.deleteMany({ where: { id, brukerId } })` and throws `TILGJENGELIGHET_EIER_FEIL` when `count === 0` — the exact same ownership-check shape `slettTimeregistrering` (`lib/timeregistrering.ts`) already uses, for the same reason: marking someone else's availability defeats the feature's purpose, the same way editing someone else's logged hours would.
- **`Arbeidshendelse` has no ownership restriction** — any admin may create, see, and delete any work event, consistent with `Utgift`/`Dokument`/`Kapitalinnskudd` (and *inconsistent* with `Tilgjengelighet` immediately above — this asymmetry is intentional: a work event is shared company information about a property, not personal availability).
- **`fraKl`/`tilKl` are optional but both-or-neither**, validated as `"HH:MM"` 24-hour strings (`/^([01]\d|2[0-3]):[0-5]\d$/`) with `fraKl` strictly before `tilKl` — on both `Tilgjengelighet` and `Arbeidshendelse`. Providing only one of the pair is rejected with a clear Norwegian message.
- **All calendar date-key logic (grid cell keys, "is this today", month/week boundaries, upsert keys) uses `new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(date)`** — the exact convention already established in `app/admin/(protected)/boliger/[id]/dokumenter/page.tsx`, `TimeregistreringPanel.tsx`, `UtgiftPanel.tsx`, and `KapitalPanel.tsx`, after this worktree already hit and fixed a UTC-vs-Oslo-off-by-one-day bug once (the Dokument `opprettet` display). Never use `date.getDate()`/`date.toISOString().slice(0, 10)` directly anywhere in this feature — a calendar grid is exactly where that bug would be most visible (a day's entries rendering under the wrong cell) and least excusable to repeat.
- **"Overlap" is day-granularity, not sub-day time-interval intersection — this is a deliberate reading of the spec, not an oversight.** §3's own goal statement is explicit: *"Gi en delt kalender hvor de fire ser hverandres tilgjengelighet og raskt finner overlappende **dager**"* ("...quickly find overlapping **days**") — the unit is the day, matching the feature's real purpose (coordinating which day all four can go work on the house together), not whether two people's specific free-time windows intersect to the minute. §7.8's "tidsintervaller" are optional detail *within* a day's entry (e.g. "ledig 09:00–15:00" vs. the whole day), not the thing being scored. `tellLedigePerDag` therefore counts distinct owners marked `"ledig"` that day regardless of any `fraKl`/`tilKl` on the row — a day where one owner is free 09:00–10:00 and another is free 14:00–18:00 counts as 2, same as if both were free all day. Computing true minute-level interval intersection across owners is out of scope for this MVP and would be premature complexity for a feature whose own spec names the day as the unit.
- **Overlap-highlighting (`tellLedigePerDag`) is a pure function in `lib/tilgjengelighet.ts`** that takes an already-fetched array of `{ dato: string; status: string }` rows for one visible range and returns a `Record<string, number>` (date-key → count of `"ledig"` rows that day). The calendar page computes the max count once and highlights every date-key tied for that max — no per-cell query.
- **A single server-resolved "anchor date" drives both the fetch range and which view (month/week) is rendered — `maned` and `dato` are never independent.** The page accepts one optional `?dato=YYYY-MM-DD` search param (defaults to today, Europe/Oslo). The anchor's month is always the fetched/displayed month; there is no separate `?maned=` param that can point somewhere else. Month view shows that whole padded month grid; week view (a client-side toggle, not a second data path) re-slices the same in-memory rows to the 7 date-keys of the anchor's own Mon–Sun week — which is always covered, because the month grid's leading/trailing padding already extends to full weeks on both ends, so the anchor's week is guaranteed to be a subset of the fetched range no matter where in the month the anchor falls. Navigating to a different week or month re-requests the page with a new `?dato=` (a new anchor), never by mutating `maned` and `dato` independently.
- NOK/norsk dato conventions from the top-level spec apply (dates shown as `dd.mm.yyyy` where this feature displays a single date outside the grid, e.g. the create-event form).
- Any logged-in admin may view the whole shared calendar (everyone's availability, all eiendommer's events) — no per-eiendom or per-user visibility restriction, consistent with spec §6 ("Fase 1-brukere er kun de fire eierne, alle med samme rolle/adgang") and with the feature's own point (seeing *each other's* availability).

## Review Focus

Points to scrutinize in the Codex review round(s) before implementation (log in `2026-10-27-kalender-tilgjengelighet-REVIEW-LOG.md`):

- The ownership asymmetry (`Tilgjengelighet` self-only vs. `Arbeidshendelse` open-to-all) must be enforced in the server action / `lib` layer, not just assumed from the UI — a direct action call with a forged `id` must not let one owner delete another's availability row.
- The 26-occurrence cap on recurring creation must be enforced server-side (in the server action or `lib` function itself), not only as a UI input `max` attribute, which is trivially bypassed.
- Date-key construction must be correct and consistent across: grid-cell generation, the `(brukerId, dato)` upsert key, and `tellLedigePerDag`'s grouping — a mismatch between any two would silently split one logical day's data across two cells or two upsert targets.
- `fraKl`/`tilKl` validation (both-or-neither, format, ordering) must be symmetric between `Tilgjengelighet` and `Arbeidshendelse` — don't implement the check twice with diverging edge-case behavior.
- The upsert semantics for `Tilgjengelighet` (same `brukerId`+`dato` overwrites, never duplicates) must hold even when re-registering a day that was originally created as part of a recurring batch — confirm it doesn't error on the existing `@@unique` constraint or silently create a second row.
- Deleting a `Bolig` that has `Arbeidshendelse` rows must get the same clear 409 dependency-check treatment the four existing dependents (`Delprosjekt`/`Kapitalinnskudd`/`Utgift`/`Dokument`) already get — not an unhandled 500.
- The `prisma.adminUser.findMany` call in Task 3's `page.tsx` must carry an explicit `select: { id: true, navn: true }` (or equivalent) — any code path that serializes a full `AdminUser` record (which includes the bcrypt `passord` hash) into client component props is a credential leak, caught in round 1 of this plan's own review.
- The anchor-date design (one `?dato=` param driving both the fetched month and the week-view slice) must actually hold at implementation time — verify there is no code path where `maned`/`dato` (or any reintroduced equivalent pair) can diverge and request a week outside the fetched range.
- The anchor-date parse in `page.tsx` must reject `2026-13-01`, `2026-02-31`, and a repeated `?dato=` query param (array instead of string) by falling back to today — not just reject non-`YYYY-MM-DD` shapes. Verify this by hand (page components aren't unit-tested in this codebase; check it via a manual request to each malformed URL during Step 4's manual verification) rather than skipping it as "the regex already covers it."

---

## Task 1: `Tilgjengelighet`/`Arbeidshendelse` models, `lib/tilgjengelighet.ts`, `lib/arbeidshendelse.ts`

**Files:**
- Modify: `prisma/schema.prisma` (add `model Tilgjengelighet`, `model Arbeidshendelse`; add back-relations on `AdminUser` and `Bolig`)
- Create: migration via `npx prisma migrate dev --name add_tilgjengelighet_arbeidshendelse`
- Create: `lib/tilgjengelighet.ts`, `lib/tilgjengelighet.test.ts`
- Create: `lib/arbeidshendelse.ts`, `lib/arbeidshendelse.test.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces (for Task 2 and Task 3):
  - `export const TILGJENGELIGHET_STATUSER = ["ledig", "ikke_ledig"] as const;` / `export type TilgjengelighetStatus = (typeof TILGJENGELIGHET_STATUSER)[number];` / `export function erGyldigTilgjengelighetStatus(verdi: unknown): verdi is TilgjengelighetStatus`
  - `export const TILGJENGELIGHET_EIER_FEIL = "Fant ikke registrering, eller du har ikke tilgang til å slette den.";`
  - `export function erGyldigKlokkeslett(verdi: unknown): verdi is string` — `typeof verdi === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(verdi)`.
  - `export function validerKlStartSlutt(fraKl?: string, tilKl?: string): string | null` — returns a Norwegian error message string if invalid, `null` if valid. Rejects exactly one of the pair being present, rejects either failing `erGyldigKlokkeslett`, rejects `fraKl >= tilKl` (plain string comparison is valid for same-format `"HH:MM"` values).
  - `export const MAKS_GJENTAKELSER = 26;`
  - `export async function settTilgjengelighet(prisma: PrismaClient, input: { brukerId: number; dato: Date; status: TilgjengelighetStatus; fraKl?: string; tilKl?: string; gjentaUkerAntall?: number }): Promise<Tilgjengelighet[]>` — if `gjentaUkerAntall` is omitted or `1`, upserts exactly one row (`where: { brukerId_dato: { brukerId, dato } }`, no `gjentakelseId`). If `gjentaUkerAntall > 1` (caller must have already validated `<= MAKS_GJENTAKELSER`), generates a `gjentakelseId` and upserts one row per week (same weekday as `dato`, `gjentaUkerAntall` total occurrences including the first), returning all created/updated rows in date order.
  - `export async function hentTilgjengelighetForPeriode(prisma: PrismaClient, fraDato: Date, tilDato: Date): Promise<Array<{ id: number; brukerId: number; brukerNavn: string; dato: Date; status: TilgjengelighetStatus; fraKl: string | null; tilKl: string | null }>>` — all users' rows in `[fraDato, tilDato]` inclusive, joined with `bruker: { select: { navn: true } }`, ordered `[{ dato: "asc" }, { brukerId: "asc" }]`.
  - `export function tellLedigePerDag(rader: Array<{ dato: string; status: string }>): Record<string, number>` — pure function, no Prisma; groups by the `dato` string key (caller passes already-formatted Europe/Oslo date keys) and counts `status === "ledig"`.
  - `export async function slettTilgjengelighet(prisma: PrismaClient, id: number, brukerId: number): Promise<void>` — mirrors `slettTimeregistrering` exactly: `deleteMany({ where: { id, brukerId } })`, throws `TILGJENGELIGHET_EIER_FEIL` if `count === 0`.
  - `export const ARBEIDSHENDELSE_FEIL = "Fant ikke arbeidshendelsen.";`
  - `export async function opprettArbeidshendelse(prisma: PrismaClient, input: { eiendomId: number; tittel: string; beskrivelse?: string; dato: Date; fraKl?: string; tilKl?: string; opprettetAvBrukerId: number }): Promise<Arbeidshendelse>` — plain insert, trusts caller (validation lives in the Task 2 server action, same convention as `opprettKapitalinnskudd`/`opprettUtgift`).
  - `export async function hentArbeidshendelserForPeriode(prisma: PrismaClient, fraDato: Date, tilDato: Date): Promise<Array<{ id: number; eiendomId: number; eiendomTittel: string; tittel: string; beskrivelse: string | null; dato: Date; fraKl: string | null; tilKl: string | null }>>` — joined with `eiendom: { select: { tittel: true } }`, ordered `{ dato: "asc" }`.
  - `export async function slettArbeidshendelse(prisma: PrismaClient, id: number): Promise<void>` — throws `new Error(ARBEIDSHENDELSE_FEIL)` if not found, otherwise deletes (no ownership check — see Global Constraints).
  - `export async function harArbeidshendelser(prisma: PrismaClient, eiendomId: number): Promise<boolean>` — mirrors `harDokumenter`/`harUtgifter`'s exact shape, used by Task 2 to extend the `Bolig` `DELETE` dependency checks.

- [ ] **Step 1: Write failing tests for status/klokkeslett helpers and `settTilgjengelighet` in `lib/tilgjengelighet.test.ts`**

Using `createTestDb()` (per `tests/helpers/testDb.ts`), cover:
- `erGyldigTilgjengelighetStatus` true for `"ledig"`/`"ikke_ledig"`, false for `""`, `"ukjent"`, `null`, `undefined`.
- `erGyldigKlokkeslett` true for `"00:00"`, `"23:59"`, `"09:30"`; false for `"24:00"`, `"9:30"`, `"9:3"`, `""`, `null`.
- `validerKlStartSlutt` returns `null` for `(undefined, undefined)` and for `("09:00", "15:00")`; returns a message for `("09:00", undefined)`, `(undefined, "15:00")`, `("15:00", "09:00")`, and `("09:00", "09:00")` (equal is invalid — must be strictly before).
- `settTilgjengelighet` with no `gjentaUkerAntall` creates exactly one row with the given `brukerId`/`dato`/`status`.
- Calling `settTilgjengelighet` twice for the same `(brukerId, dato)` with a different `status` the second time results in exactly one row for that day, with the second call's `status` — never two rows.
- `settTilgjengelighet` with `gjentaUkerAntall: 4` creates 4 rows, one per week starting at `dato`, all sharing the same non-null `gjentakelseId`.

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run lib/tilgjengelighet.test.ts`
Expected: FAIL (module `lib/tilgjengelighet.ts` does not exist yet).

- [ ] **Step 3: Add `model Tilgjengelighet` and `model Arbeidshendelse` to `prisma/schema.prisma`**

```prisma
model Tilgjengelighet {
  id             Int       @id @default(autoincrement())
  brukerId       Int
  bruker         AdminUser @relation(fields: [brukerId], references: [id])
  dato           DateTime
  status         String
  fraKl          String?
  tilKl          String?
  gjentakelseId  String?
  opprettet      DateTime  @default(now())

  @@unique([brukerId, dato])
}

model Arbeidshendelse {
  id                  Int       @id @default(autoincrement())
  eiendomId           Int
  eiendom             Bolig     @relation(fields: [eiendomId], references: [id])
  tittel              String
  beskrivelse         String?
  dato                DateTime
  fraKl               String?
  tilKl               String?
  opprettetAvBrukerId Int
  opprettetAvBruker   AdminUser @relation(fields: [opprettetAvBrukerId], references: [id])
  opprettet           DateTime  @default(now())
}
```

Add `tilgjengelighet Tilgjengelighet[]` and `arbeidshendelser Arbeidshendelse[]` to `model AdminUser` (two separate relations — `arbeidshendelser` needs an explicit `@relation("ArbeidshendelseOpprettetAv")` name only if `AdminUser` ends up with more than one field pointing at `Arbeidshendelse`; it doesn't, so no relation name is needed). Add `arbeidshendelser Arbeidshendelse[]` to `model Bolig`.

- [ ] **Step 4: Generate the migration and reconcile migration history**

Run: `npx prisma migrate dev --name add_tilgjengelighet_arbeidshendelse`

This worktree has hit Prisma migration-checksum drift on every `migrate dev` run so far. If it recurs:
1. Apply the equivalent `CREATE TABLE` SQL by hand against `dev.db` via `sqlite3`, matching the column types/nullability/unique-index above exactly.
2. Write a migration file under `prisma/migrations/<timestamp>_add_tilgjengelighet_arbeidshendelse/migration.sql` with that exact SQL.
3. Record it as applied: `npx prisma migrate resolve --applied <timestamp>_add_tilgjengelighet_arbeidshendelse`.

Do not run `prisma migrate reset`. Then run `npx prisma generate`.

- [ ] **Step 5: Implement `lib/tilgjengelighet.ts`**

Per the Interfaces block above. `settTilgjengelighet`'s single-row path is `prisma.tilgjengelighet.upsert({ where: { brukerId_dato: { brukerId: input.brukerId, dato: input.dato } }, create: {...}, update: {...} })`. The recurring path loops `gjentaUkerAntall` times, adding `7 * i` days to `dato` for each iteration (construct via `new Date(dato.getTime() + 7 * i * 86_400_000)`), generates one `gjentakelseId = crypto.randomUUID()` shared across all iterations, and `upsert`s each (so re-running a recurring registration over an already-marked day still converges to one row per day). `tellLedigePerDag` is a plain `reduce`, no Prisma import.

- [ ] **Step 6: Run the tests, verify they pass**

Run: `npx vitest run lib/tilgjengelighet.test.ts`
Expected: PASS

- [ ] **Step 7: Write failing tests for `hentTilgjengelighetForPeriode`, `tellLedigePerDag`, and `slettTilgjengelighet` in `lib/tilgjengelighet.test.ts`**

Add:
- `hentTilgjengelighetForPeriode` across two users with rows inside and outside the queried range returns only the in-range rows, each with the correct `brukerNavn`.
- `tellLedigePerDag` with rows `[{dato:"2026-11-02",status:"ledig"}, {dato:"2026-11-02",status:"ledig"}, {dato:"2026-11-02",status:"ikke_ledig"}, {dato:"2026-11-03",status:"ledig"}]` returns `{ "2026-11-02": 2, "2026-11-03": 1 }`. Empty input returns `{}`.
- `slettTilgjengelighet` by its owner succeeds and the row is gone from a subsequent `hentTilgjengelighetForPeriode`.
- `slettTilgjengelighet` by a *different* `brukerId` throws an `Error` whose `.message === TILGJENGELIGHET_EIER_FEIL`, and the row still exists afterward.
- `slettTilgjengelighet` on a non-existent `id` throws the same error.

- [ ] **Step 8: Run to verify failure, implement, run again to verify pass**

Run: `npx vitest run lib/tilgjengelighet.test.ts`
Expected: PASS (all tests, this file). If Step 7's tests fail against the Step 5 implementation, fix the implementation, not the test.

- [ ] **Step 9: Write failing tests for `lib/arbeidshendelse.ts`**

In `lib/arbeidshendelse.test.ts`, using `createTestDb()`, cover:
- `opprettArbeidshendelse` with a full valid input creates a row; returned fields match input, `beskrivelse`/`fraKl`/`tilKl` are `null` when omitted.
- `hentArbeidshendelserForPeriode` across two eiendommer, one event inside and one outside the range, returns only the in-range one with the correct `eiendomTittel`.
- `slettArbeidshendelse` on an existing row succeeds (subsequent `hentArbeidshendelserForPeriode` no longer includes it); on a non-existent `id` throws `Error` with `.message === ARBEIDSHENDELSE_FEIL`.
- `harArbeidshendelser` returns `false` for an eiendom with none, `true` once one exists.

- [ ] **Step 10: Run the tests, verify they fail**

Run: `npx vitest run lib/arbeidshendelse.test.ts`
Expected: FAIL (module does not exist yet).

- [ ] **Step 11: Implement `lib/arbeidshendelse.ts`**

Per the Interfaces block above — straightforward `create`/`findMany`/`delete`/`count` calls, same shape as `lib/utgift.ts`'s equivalents.

- [ ] **Step 12: Run the tests, verify they pass**

Run: `npx vitest run lib/arbeidshendelse.test.ts`
Expected: PASS

- [ ] **Step 13: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 14: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/tilgjengelighet.ts lib/tilgjengelighet.test.ts lib/arbeidshendelse.ts lib/arbeidshendelse.test.ts app/generated
git commit -m "feat: add Tilgjengelighet/Arbeidshendelse models and data-access layer"
```

---

## Task 2: Server actions (`app/admin/(protected)/kalender/actions.ts`)

**Files:**
- Create: `app/admin/(protected)/kalender/actions.ts`
- Modify: `app/api/boliger/[id]/route.ts` (extend the `DELETE` dependency check with `harArbeidshendelser`)
- Test: `app/api/boliger/[id]/route.test.ts` (add one case to the existing dependency-check tests, if that file already covers the other three dependents the same way — otherwise add a focused test next to wherever those are currently covered)

**Interfaces:**
- Consumes: everything exported from Task 1's `lib/tilgjengelighet.ts` and `lib/arbeidshendelse.ts`.
- Produces (for Task 3):
  - `export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };` (reuse the existing type if the plan's final implementer finds it's already exported somewhere shared — otherwise redeclare locally, matching `delprosjekter/actions.ts`'s own copy).
  - `export async function settTilgjengelighetAction(input: { dato: string; status: string; fraKl?: string; tilKl?: string; gjentaUkerAntall?: number }): Promise<HandlingResultat<null>>`
  - `export async function slettTilgjengelighetAction(id: number): Promise<HandlingResultat<null>>`
  - `export async function opprettArbeidshendelseAction(input: { eiendomId: number; tittel: string; beskrivelse?: string; dato: string; fraKl?: string; tilKl?: string }): Promise<HandlingResultat<null>>`
  - `export async function slettArbeidshendelseAction(id: number): Promise<HandlingResultat<null>>`

- [ ] **Step 1: Implement `settTilgjengelighetAction`**

Validate (in order, returning `{ ok: false, feilmelding }` on first failure, mirroring `registrerTimerAction`'s style exactly):
- Session exists (`getServerSession(authOptions)`, throw `"Ikke autorisert."` if not — same as every existing action).
- `dato` matches `/^\d{4}-\d{2}-\d{2}$/` and round-trips (same `new Date(...)` + `.toISOString().slice(0,10)` check `registrerTimerAction`/`registrerUtgiftAction` already use).
- `erGyldigTilgjengelighetStatus(input.status)`.
- `validerKlStartSlutt(input.fraKl, input.tilKl)` returns `null`.
- If `input.gjentaUkerAntall !== undefined`: `Number.isInteger(input.gjentaUkerAntall) && input.gjentaUkerAntall >= 1 && input.gjentaUkerAntall <= MAKS_GJENTAKELSER` (reject with a message naming the 26-week cap otherwise — this is the server-side enforcement the Review Focus calls out, independent of any UI `max` attribute).

Then call `settTilgjengelighet(prisma, { brukerId: Number(session.user.id), dato, status, fraKl, tilKl, gjentaUkerAntall })`, return `{ ok: true, data: null }`. Revalidate the kalender path (`revalidatePath("/admin/kalender")`).

- [ ] **Step 2: Implement `slettTilgjengelighetAction`**

Session check, then `try { await slettTilgjengelighet(prisma, id, Number(session.user.id)); return { ok: true, data: null }; } catch`, mapping `TILGJENGELIGHET_EIER_FEIL` to its own message and anything else to a generic `"Noe gikk galt. Prøv igjen."` with `console.error`, exactly matching `slettTimeregistreringAction`'s shape.

- [ ] **Step 3: Implement `opprettArbeidshendelseAction`**

Validate: session, `dato` format (same pattern), `tittel.trim()` non-empty, `validerKlStartSlutt(input.fraKl, input.tilKl)` is `null`, `eiendomId` is an integer and `prisma.bolig.findUnique({ where: { id: input.eiendomId } })` exists (reuse `"Fant ikke eiendommen."` message, matching `registrerUtgiftAction`). Then `opprettArbeidshendelse(prisma, { ...input, dato, opprettetAvBrukerId: Number(session.user.id) })`, revalidate, return `{ ok: true, data: null }`.

- [ ] **Step 4: Implement `slettArbeidshendelseAction`**

Session check, `try { await slettArbeidshendelse(prisma, id); ... } catch` mapping `ARBEIDSHENDELSE_FEIL`, matching `slettUtgiftAction`'s shape exactly (no ownership check — see Global Constraints).

- [ ] **Step 5: Extend `app/api/boliger/[id]/route.ts`'s `DELETE` dependency checks**

Find the existing sequence of `harDelprosjekter`/`harKapitalinnskudd`/`harUtgifter`/`harDokumenter` checks (each returning a 409 with a specific Norwegian message) and add a fifth: `harArbeidshendelser(prisma, id)` → 409 with an equivalent message naming "arbeidshendelser".

- [ ] **Step 6: Write/extend the dependency-check test for the new `Arbeidshendelse` case**

Find wherever the existing four dependency cases are tested for this route (likely `app/api/boliger/[id]/route.test.ts` or colocated), add: deleting a `Bolig` that only has an `Arbeidshendelse` row returns 409 with the new message; deleting one with none of the five dependents still succeeds (204/200, whatever the existing passing case already asserts).

- [ ] **Step 7: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/admin/\(protected\)/kalender/actions.ts app/api/boliger/[id]/route.ts app/api/boliger/[id]/route.test.ts
git commit -m "feat: add tilgjengelighet/arbeidshendelse server actions and Bolig delete guard"
```

---

## Task 3: Kalender page UI

**Files:**
- Create: `app/admin/(protected)/kalender/page.tsx`
- Create: `app/admin/(protected)/kalender/KalenderGrid.tsx` (client component)
- Modify: `app/admin/(protected)/AdminNavbar.tsx` (add "Kalender" nav link)

- [ ] **Step 1: `page.tsx` — fetch and compose**

Server component. Reads one optional `?dato=YYYY-MM-DD` search param as the anchor date (if the param is repeated, Next.js's `searchParams` gives an array — treat anything other than a single string as invalid). Validated the same way `registrerTimerAction`/`registrerUtgiftAction` already validate a date string: matches `/^\d{4}-\d{2}-\d{2}$/`, parses to a finite `Date`, and round-trips exactly (`new Date(\`${dato}T00:00:00.000Z\`).toISOString().slice(0, 10) === dato`) — this is what actually rejects `2026-13-01` and `2026-02-31`, which the regex alone accepts syntactically but which `Date` normalizes into a different month/day, since `1` ≤ month ≤ `12` and `1` ≤ day ≤ the month's actual length aren't regex-expressible. Falls back to today's Europe/Oslo date (via the established `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" })` pattern) on any validation failure. Derives the anchor's month from the anchor itself (no separate month param — see Global Constraints). Computes that month's first/last date plus enough leading/trailing days to fill whole Monday-start weeks (matching Norwegian convention) — this padded range always fully contains the anchor's own week. Fetches in parallel: `hentTilgjengelighetForPeriode`, `hentArbeidshendelserForPeriode` (both for the full padded grid range), `prisma.adminUser.findMany({ where: { rolle: "eier" }, orderBy: { navn: "asc" }, select: { id: true, navn: true } })` (for the legend and the registration form — **`select` is required here**: `AdminUser` also has a `passord` column holding a bcrypt hash, which must never reach a client component's serialized props), `prisma.bolig.findMany({ orderBy: { tittel: "asc" }, select: { id: true, tittel: true } })` (for the event-creation eiendom dropdown — same field-limiting discipline). Passes the anchor date, the padded grid's date-keys, and all fetched rows to `<KalenderGrid />`.

- [ ] **Step 2: `KalenderGrid.tsx` — month/week grid with color-coding, overlap highlighting, and a day-detail view**

Client component. Renders a 7-column grid (Mon–Sun) for the full padded month. Each day cell shows: the date number, one small colored dot per owner with a `Tilgjengelighet` row that day (color from a fixed 6-entry palette array indexed by `brukerId % palette.length`, deterministic, no new model field needed) — **the dot's style distinguishes `"ledig"` (filled) from `"ikke_ledig"` (outlined/muted), so "unavailable" never renders identically to "no response"** — a count badge from `tellLedigePerDag`'s output (counting only `"ledig"` rows, per the day-granularity overlap decision above), and up to 2 `Arbeidshendelse` titles for that day (with a "+N more" indicator when there are more). Cells whose count equals the visible grid's maximum non-zero count get a highlighted background (the spec's "most overlap" view). Clicking a day cell opens a day-detail panel (below or beside the grid, not a new route) listing: every owner's status for that day with their `fraKl`–`tilKl` interval when set (or "hele dagen" when not), a delete control next to the current session's own entry only (calling `slettTilgjengelighetAction` — never shown for another owner's entry, consistent with the self-only ownership rule), the day's `Arbeidshendelse` rows in full (title, beskrivelse, fraKl–tilKl, eiendom name) each with its own delete control (calling `slettArbeidshendelseAction` — shown regardless of who created it), and the two creation forms (`settTilgjengelighetAction` with status radio/optional `fraKl`+`tilKl`/optional "gjenta ukentlig i N uker" number input capped at 26 in the input's `max` *and* relying on the action's own server-side cap; `opprettArbeidshendelseAction` with eiendom select/tittel/optional beskrivelse/fraKl/tilKl), both scoped to the clicked day. A month/week view toggle re-renders the same in-memory grid data narrowed to the anchor's own 7 date-keys for week view — always a subset of the already-fetched padded range (see Global Constraints), so this never needs a new fetch. Use `router.refresh()` after each action call (matching the existing panels' pattern) rather than local optimistic state.

- [ ] **Step 3: Add the nav link**

In `AdminNavbar.tsx`, add a `Link href="/admin/kalender"` entry between "Boliger" and "Henvendelser" (matching the existing `pathname.startsWith(...)` active-state pattern), labeled "Kalender".

- [ ] **Step 4: Manual verification (human partner)**

This is a UI/browser-interaction step this session cannot reliably complete itself (per this worktree's established pattern — credential/login-gated manual checks are expected to be done by the user, not worked around). Ask the human partner to: log in, open `/admin/kalender`, mark a few days available/unavailable for themselves (including one recurring registration), confirm the overlap highlight appears on the day with the most "ledig" marks, create and delete an `Arbeidshendelse`, and confirm week/month toggle both render correctly.

- [ ] **Step 5: Run the full suite one more time**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/kalender" "app/admin/(protected)/AdminNavbar.tsx"
git commit -m "feat: add Kalender page with availability grid and arbeidshendelser"
```

---

## Final whole-branch review

After all three tasks are committed, run a final review across the whole feature (not per-task) covering every point in Review Focus above, plus: does the grid correctly handle a month boundary that spans two different week-start alignments (e.g. November 2026 starting on a Sunday); does a recurring registration that crosses a month boundary still show correctly in both months' views.
