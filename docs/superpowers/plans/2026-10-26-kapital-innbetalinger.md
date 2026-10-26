# Kapital & innbetalinger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin record capital contributions ("kapitalinnskudd") that the four owners have made to a specific eiendom, and show each owner's resulting ownership share (%) for that eiendom.

**Architecture:** A new `Kapitalinnskudd` model (eiendom + bruker + dato + beløp + beskrivelse), a data-access module mirroring `lib/timeregistrering.ts`, two Server Actions mirroring `registrerTimerAction`/`slettTimeregistreringAction`, and a new `/admin/boliger/[id]/kapital` page with a client panel mirroring `TimeregistreringPanel.tsx`.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (sqlite), NextAuth v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` (§7.3 Kapital & innbetalinger)

## Global Constraints

- NOK som valuta, norsk datoformat (dd.mm.yyyy for visning), Europe/Oslo tidssone — eksakt som i Timeregistrering-modulen (§7.5, allerede implementert).
- Beløp lagres som heltall i hele kroner (`Int`), samme konvensjon som `Bolig.pris`/`Bolig.kjopesum` — ingen øre-presisjon.
- De fire eierne er allerede seedet som `AdminUser`-rader med `rolle = "eier"`. Eierandelene (§7.3) beregnes kun over brukere med `rolle === "eier"` — ikke over alle `AdminUser`-rader, i tilfelle en fremtidig ikke-eier-admin legges til.
- **Ikke** implementer §7.6 Fortjenestefordeling (80/10/10-fordelingen) i denne planen — den er en egen, senere plan som leser kapitaldataene denne planen bygger. Denne planen leverer kun innskudd + eierandel i %.
- `npx prisma migrate dev` kjører ikke `generate` automatisk på denne Prisma-versjonen (gjentatt funn fra Fundament- og Timeregistrering-fasene) — eksplisitt `npx prisma generate`-steg er nødvendig etter enhver migrasjon.
- `/api/boliger` sine POST/PUT-endepunkter bruker allerede en allow-list (`plukkSkrivbareBoligFelter` i `lib/eiendom.ts`) som kun plukker ut en fast liste skalarfelt — en ny relasjon på `Bolig` (`kapitalinnskudd`) plukkes aldri med, og trenger ingen endring der.
- Denne worktreens `dev.db` har tidligere hatt migrasjons-sjekksum-drift som blokkerte `migrate dev` (løst i forrige plan ved å utlede migrasjonen manuelt i stedet for `migrate reset`). Hvis `migrate dev` i Steg 2 under rapporterer drift igjen: **ikke** kjør `migrate reset` — skriv migrasjonsfilen manuelt (SQL er gitt i Steg 2), verifiser den mot en engangs-sqlite-fil med `migrate deploy --schema <path>`, og kjør deretter `prisma generate`.

## Review Focus

- **Null innskudd registrert ennå:** `beregnEierandeler` må returnere 0 % til alle eiere (ikke `NaN`/`Infinity`) når totalbeløpet for eiendommen er 0.
- **Ugyldig beløp:** et negativt, null, eller ikke-heltallig beløp (f.eks. `0`, `-500`, `100.5`) må avvises med en tydelig feilmelding, ikke lagres.
- **Ugyldig/kalender-ugyldig dato:** samme klasse feil som ble funnet i Timeregistrering (`"2026-02-30"` ruller stille over, en full tidsstempel-streng godtas) må avvises her også.
- **Sletting med manglende/ugyldig id:** et `undefined`- eller objekt-id til slettingen må avvises før databasen kalles, ikke falle gjennom til et bredt `deleteMany` (samme klasse feil som TR-07 i Timeregistrering-reviewen).
- **`brukerId` som ikke er en gyldig eier:** et `brukerId` som ikke finnes, eller som finnes men ikke har `rolle === "eier"`, må avvises — ikke lagres som et innskudd fra en ukjent/ikke-eier-bruker.

---

### Task 1: Datamodell og datalag

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_legg_til_kapitalinnskudd/migration.sql`
- Create: `lib/kapitalinnskudd.ts`
- Create: `lib/kapitalinnskudd.test.ts`
- Modify: `app/api/boliger/[id]/route.ts`
- Modify: `app/api/boliger/[id]/route.test.ts`

**Interfaces:**
- Produces: `KAPITALINNSKUDD_FEIL: string`; `opprettKapitalinnskudd(prisma, input: { eiendomId: number; brukerId: number; dato: Date; belop: number; beskrivelse?: string }): Promise<Kapitalinnskudd>`; `hentInnskuddForEiendom(prisma, eiendomId: number): Promise<Array<{ id: number; dato: Date; belop: number; beskrivelse: string | null; brukerId: number; brukerNavn: string }>>`; `beregnEierandeler(prisma, eiendomId: number): Promise<Array<{ brukerId: number; brukerNavn: string; belop: number; andelProsent: number }>>`; `slettKapitalinnskudd(prisma, id: number): Promise<void>`; `harKapitalinnskudd(prisma, eiendomId: number): Promise<boolean>` (mirrors `harDelprosjekter` in `lib/delprosjekt.ts`, used by the DELETE route below).

- [ ] **Step 1: Add the `Kapitalinnskudd` model and relations to `prisma/schema.prisma`**

```prisma
model Kapitalinnskudd {
  id          Int       @id @default(autoincrement())
  eiendomId   Int
  eiendom     Bolig     @relation(fields: [eiendomId], references: [id])
  brukerId    Int
  bruker      AdminUser @relation(fields: [brukerId], references: [id])
  dato        DateTime
  belop       Int
  beskrivelse String?
  opprettet   DateTime  @default(now())
}
```

Add `kapitalinnskudd Kapitalinnskudd[]` to `model Bolig` and to `model AdminUser` (next to their existing `delprosjekter`/`timeregistreringer` relation lines).

- [ ] **Step 2: Create the migration**

Run `npx prisma migrate dev --name legg_til_kapitalinnskudd`. If it applies cleanly, skip to Step 3. If it reports checksum drift (see Global Constraints), instead create `prisma/migrations/<YYYYMMDDHHMMSS>_legg_til_kapitalinnskudd/migration.sql` by hand (timestamp later than `20261026142002`) with exactly:

```sql
-- CreateTable
CREATE TABLE "Kapitalinnskudd" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "eiendomId" INTEGER NOT NULL,
    "brukerId" INTEGER NOT NULL,
    "dato" DATETIME NOT NULL,
    "belop" INTEGER NOT NULL,
    "beskrivelse" TEXT,
    "opprettet" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Kapitalinnskudd_eiendomId_fkey" FOREIGN KEY ("eiendomId") REFERENCES "Bolig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Kapitalinnskudd_brukerId_fkey" FOREIGN KEY ("brukerId") REFERENCES "AdminUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
```

Then apply it to `dev.db` (via `migrate dev`, or `migrate deploy` if drift blocked the dev flow) and verify with `npx prisma migrate status` — expect "Database schema is up to date!".

- [ ] **Step 3: Run `npx prisma generate` explicitly**

Required separately from Step 2 on this Prisma version (see Global Constraints).

- [ ] **Step 4: Write the failing tests in `lib/kapitalinnskudd.test.ts`**

Mirror the structure of `lib/timeregistrering.test.ts` (same `createTestDb()` helper). Cover:

```ts
describe("opprettKapitalinnskudd og hentInnskuddForEiendom", () => {
  it("lagrer et innskudd og henter det tilbake med navn på eieren", async () => { /* create Bolig + AdminUser(rolle: "eier"), opprettKapitalinnskudd, assert hentInnskuddForEiendom returns belop + brukerNavn */ });
  it("sorterer nyeste dato først", async () => { /* two innskudd, different dato, assert order */ });
});

describe("beregnEierandeler", () => {
  it("beregner eierandel i prosent basert på innskutt beløp", async () => {
    // two AdminUser rows with rolle: "eier", innskudd 7500 and 2500 on the same eiendom
    // assert andelProsent ≈ 75 and 25 (use toBeCloseTo)
  });
  it("returnerer 0 % til alle eiere når ingen innskudd er registrert", async () => {
    // one AdminUser rolle: "eier", zero Kapitalinnskudd rows for the eiendom
    // assert belop === 0 and andelProsent === 0 (not NaN)
  });
  it("inkluderer eiere uten egne innskudd med 0 kr og 0 %", async () => {
    // two AdminUser rolle: "eier"; only one of them has an innskudd
    // assert both appear in the result, the contributor's andelProsent is 100, the other's is 0
  });
  it("regner ikke med innskudd fra en bruker som ikke er eier", async () => {
    // one AdminUser rolle: "eier" with a 5000 innskudd, one AdminUser rolle: "annet" (created directly via
    // prisma.adminUser.create, bypassing registrerInnskuddAction's own role check) with its own 5000 innskudd
    // on the same eiendom, created directly via prisma.kapitalinnskudd.create (not opprettKapitalinnskudd,
    // since that function doesn't itself check role — only the action layer does; this test is about the
    // read-side aggregate staying correct even if a non-eier row exists in the data for any reason)
    // assert the result contains only the one eier, with belop 5000 and andelProsent 100 — the non-eier's
    // 5000 must not appear anywhere in the result and must not inflate the denominator
  });
});

describe("harKapitalinnskudd", () => {
  it("returnerer false når eiendommen ikke har noen innskudd", async () => { /* assert false */ });
  it("returnerer true når eiendommen har minst ett innskudd", async () => { /* create one, assert true */ });
});

describe("slettKapitalinnskudd", () => {
  it("sletter innskuddet når id finnes", async () => { /* create then delete, assert count 0 */ });
  it("kaster feil når id ikke finnes", async () => { /* delete a non-existent id, expect rejects.toThrow */ });
  it("kaster feil for et ugyldig id i stedet for å slette bredt (undefined eller et objekt)", async () => {
    // seed two innskudd rows; call slettKapitalinnskudd(prisma, undefined as unknown as number) and
    // slettKapitalinnskudd(prisma, { gt: 0 } as unknown as number); both must reject and count must stay 2
  });
});
```

- [ ] **Step 5: Run tests to verify they fail with "module not found" / "is not a function"**

Run: `npx vitest run lib/kapitalinnskudd.test.ts`

- [ ] **Step 6: Implement `lib/kapitalinnskudd.ts`**

```ts
import type { PrismaClient, Kapitalinnskudd } from "@/app/generated/prisma/client";

export const KAPITALINNSKUDD_FEIL = "Fant ikke innskuddet.";

export async function opprettKapitalinnskudd(
  prisma: PrismaClient,
  input: { eiendomId: number; brukerId: number; dato: Date; belop: number; beskrivelse?: string }
): Promise<Kapitalinnskudd> { /* prisma.kapitalinnskudd.create */ }

export async function hentInnskuddForEiendom(
  prisma: PrismaClient,
  eiendomId: number
): Promise<Array<{ id: number; dato: Date; belop: number; beskrivelse: string | null; brukerId: number; brukerNavn: string }>> {
  /* findMany where eiendomId, include bruker, orderBy [{dato:"desc"},{id:"desc"}], map to flat shape */
}

export async function beregnEierandeler(
  prisma: PrismaClient,
  eiendomId: number
): Promise<Array<{ brukerId: number; brukerNavn: string; belop: number; andelProsent: number }>> {
  /*
    1. eiere = prisma.adminUser.findMany({ where: { rolle: "eier" } })
    2. eierIder = new Set(eiere.map(e => e.id))
    3. innskudd = prisma.kapitalinnskudd.findMany({ where: { eiendomId, brukerId: { in: [...eierIder] } } })
       — scoping the query itself to brukerId ∈ eierIder (not just filtering the *output* rows to eiere)
       keeps the denominator consistent with the numerator: a Kapitalinnskudd row belonging to a brukerId
       that is not currently rolle "eier" (e.g. a role changed after the contribution was recorded) is
       excluded from BOTH the per-bruker sum and totalBelop, not just hidden from the returned list. This
       is what keeps the eiere's andelProsent values summing to 100 whenever eier capital exists.
    4. sum belop per brukerId from innskudd (plain JS reduce — four owners, no need for a Prisma groupBy)
    5. totalBelop = sum of all innskudd belop (already eiere-only per step 3)
    6. for each eier: andelProsent = totalBelop > 0 ? (belopForEier / totalBelop) * 100 : 0
    7. sort by belop desc, tie-break by brukerNavn.localeCompare
  */
}

export async function slettKapitalinnskudd(prisma: PrismaClient, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) throw new Error(KAPITALINNSKUDD_FEIL);
  const resultat = await prisma.kapitalinnskudd.deleteMany({ where: { id } });
  if (resultat.count === 0) throw new Error(KAPITALINNSKUDD_FEIL);
}

export async function harKapitalinnskudd(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.kapitalinnskudd.count({ where: { eiendomId } })) > 0;
}
```

Note the deliberate difference from `slettTimeregistrering`: there is no `brukerId` in the `deleteMany` where-clause. Kapitalinnskudd rows are shared company bookkeeping facts (any of the four co-owner admins may correct any entry), not personal logs — so deletion is not restricted to whoever originally entered the row. This is the plan's own call on an ambiguity the spec leaves open.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run lib/kapitalinnskudd.test.ts`
Expected: PASS, all cases including the four `beregnEierandeler` cases, the two `harKapitalinnskudd` cases, and the malformed-id `slettKapitalinnskudd` case.

- [ ] **Step 8: Harden the `Bolig` DELETE route for the new foreign key**

`Kapitalinnskudd.eiendomId` has `ON DELETE RESTRICT` (Step 1/2), so `app/api/boliger/[id]/route.ts`'s `DELETE` handler can now be blocked by capital contributions, not only by delprosjekter — but today it only checks `harDelprosjekter` and only reports the delprosjekt-specific message for any `P2003`. A property with contributions but zero delprosjekter would hit the generic `P2003` catch and get told it has delprosjekter, which is false.

In `app/api/boliger/[id]/route.ts`:
1. Import `harKapitalinnskudd` from `@/lib/kapitalinnskudd`.
2. After the existing `harDelprosjekter` fast-path check and before `prisma.bolig.delete`, add:
   ```ts
   if (await harKapitalinnskudd(prisma, eiendomId)) {
     return NextResponse.json(
       { error: "Kan ikke slette en eiendom med registrerte kapitalinnskudd." },
       { status: 409 }
     );
   }
   ```
3. Change the `P2003` catch's message (the race-condition fallback, where we no longer know which of the two foreign keys fired) from `"Kan ikke slette en eiendom med registrerte delprosjekter."` to `"Kan ikke slette en eiendom med registrerte delprosjekter eller kapitalinnskudd."` — the two specific fast-path checks above keep giving the precise message in the common case; this generic one only fires on the rare insert-during-delete race.

In `app/api/boliger/[id]/route.test.ts`:

1. The hoisted `prismaMock` (top of file, inside `vi.hoisted(() => ({ prismaMock: { ... } }))`) only defines `bolig` and `delprosjekt` today. Add a `kapitalinnskudd: { count: vi.fn() }` entry to that same object, alongside the existing `delprosjekt: { count: vi.fn() }` entry — `harKapitalinnskudd` calls `prisma.kapitalinnskudd.count`, and without this the mock Prisma client has no such property for any test to configure.
2. Update the *existing* `"gir 409 (ikke en ufanget 500) hvis et delprosjekt opprettes i kappløpet..."` test: add `prismaMock.kapitalinnskudd.count.mockResolvedValue(0)` before the request (the new fast-path check now runs unconditionally before every delete attempt, so this test needs the mock defined too), **and** change its expected `body.error` from the old delprosjekter-only message to the new combined one, `"Kan ikke slette en eiendom med registrerte delprosjekter eller kapitalinnskudd."` — with both fast-path counts at 0, this scenario now falls into the generic `P2003` catch (Step 8.3 below), which no longer knows which of the two foreign keys fired.
3. Add one new test to the same `describe("DELETE /api/boliger/[id]", ...)` block, for the *new* fast-path check (distinct from the race-condition scenario above, which exercises the `P2003` catch, not the fast-path):
```ts
it("gir 409 (rask vei) hvis eiendommen har registrerte kapitalinnskudd, og sletter aldri", async () => {
  prismaMock.delprosjekt.count.mockResolvedValue(0);
  prismaMock.kapitalinnskudd.count.mockResolvedValue(1);
  // DELETE request, assert status 409, body.error === "Kan ikke slette en eiendom med registrerte kapitalinnskudd.",
  // and prismaMock.bolig.delete was never called
});
```
(No second new test for the generic `P2003` fallback is needed — once both fast-path counts are mocked to 0, the updated existing race-condition test in point 2 above already is that scenario.)

- [ ] **Step 9: Run the full test suite to verify Step 8 didn't break the pre-existing DELETE tests**

Run: `npx vitest run "app/api/boliger/[id]/route.test.ts"`
Expected: PASS, including both pre-existing tests (one with its message assertion updated per Step 8.2) and the one new test.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/kapitalinnskudd.ts lib/kapitalinnskudd.test.ts "app/api/boliger/[id]/route.ts" "app/api/boliger/[id]/route.test.ts"
git commit -m "feat: add Kapitalinnskudd model and data-access layer"
```

---

### Task 2: Server Actions

**Files:**
- Create: `app/admin/(protected)/boliger/[id]/kapital/actions.ts`
- Create: `app/admin/(protected)/boliger/[id]/kapital/actions.test.ts`

**Interfaces:**
- Consumes: `opprettKapitalinnskudd`, `slettKapitalinnskudd`, `KAPITALINNSKUDD_FEIL` from `lib/kapitalinnskudd.ts` (Task 1); `authOptions` from `lib/auth.ts`; `prisma` from `lib/prisma.ts`.
- Produces: `HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string }` (same shape as the existing one in `delprosjekter/actions.ts`, defined locally here — not imported, to avoid a cross-route-folder type dependency for a one-line alias); `registrerInnskuddAction(input: { eiendomId: number; brukerId: number; dato: string; belop: number; beskrivelse?: string }): Promise<HandlingResultat<Kapitalinnskudd>>`; `slettInnskuddAction(id: number): Promise<HandlingResultat<null>>`.

- [ ] **Step 1: Write the failing tests in `actions.test.ts`**

Mirror `app/admin/(protected)/boliger/[id]/delprosjekter/actions.test.ts`'s mocking style (`vi.mock("next-auth", ...)`, `vi.mock("@/lib/prisma", ...)`). Cover:

```ts
describe("registrerInnskuddAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 5000 })).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettInnskuddAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettInnskuddAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("registrerInnskuddAction med innlogget sesjon", () => {
  // for each test: vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
  it("avviser et beløp som ikke er et positivt heltall", async () => { /* belop: 0 -> resultat.ok === false, feilmelding matches /beløp/i */ });
  it("avviser en kalenderdato som ikke finnes (2026-02-30)", async () => { /* dato: "2026-02-30" -> ok === false, feilmelding matches /dato/i */ });
  it("avviser en tidsstempel-streng i stedet for en ren kalenderdato", async () => { /* dato: "2026-10-20T23:00:00.000Z" -> ok === false, feilmelding matches /dato/i */ });
  it("avviser når eiendommen ikke finnes", async () => {
    // mock prisma.bolig.findUnique to resolve null; belop: 5000, dato: "2026-10-20" valid
    // assert ok === false, feilmelding matches /eiendommen/i
  });
  it("avviser når brukeren ikke er en registrert eier", async () => {
    // mock prisma.bolig.findUnique to resolve { id: 1 }; mock prisma.adminUser.findUnique to resolve null
    // assert ok === false, feilmelding matches /eier/i
  });
});

describe("slettInnskuddAction med innlogget sesjon", () => {
  it("avviser et manglende id uten å kalle databasen", async () => {
    // slettInnskuddAction(undefined as unknown as number) -> ok === false, feilmelding === KAPITALINNSKUDD_FEIL
  });
  it("oversetter en uventet databasefeil til en generisk feilmelding", async () => {
    // mock prisma.kapitalinnskudd.deleteMany to reject with new Error("boom")
    // assert feilmelding === "Noe gikk galt. Prøv igjen.", not "boom", not KAPITALINNSKUDD_FEIL
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "app/admin/(protected)/boliger/[id]/kapital/actions.test.ts"`

- [ ] **Step 3: Implement `actions.ts`**

```ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Kapitalinnskudd } from "@/app/generated/prisma/client";
import { opprettKapitalinnskudd, slettKapitalinnskudd, KAPITALINNSKUDD_FEIL } from "@/lib/kapitalinnskudd";

export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function registrerInnskuddAction(input: {
  eiendomId: number;
  brukerId: number;
  dato: string;
  belop: number;
  beskrivelse?: string;
}): Promise<HandlingResultat<Kapitalinnskudd>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  // 1. dato: same regex + round-trip check as registrerTimerAction in delprosjekter/actions.ts
  //    (^\d{4}-\d{2}-\d{2}$, new Date(`${input.dato}T00:00:00.000Z`), isNaN + toISOString().slice(0,10) compare)
  //    -> { ok: false, feilmelding: "Ugyldig dato." }

  // 2. belop: !Number.isInteger(input.belop) || input.belop <= 0
  //    -> { ok: false, feilmelding: "Beløp må være et positivt heltall." }

  // 3. eiendomId: !Number.isInteger(input.eiendomId) OR prisma.bolig.findUnique({ where: { id: input.eiendomId } }) is null
  //    -> { ok: false, feilmelding: "Fant ikke eiendommen." }

  // 4. brukerId: !Number.isInteger(input.brukerId) OR the AdminUser fetched via
  //    prisma.adminUser.findUnique({ where: { id: input.brukerId } }) is null or its rolle !== "eier"
  //    -> { ok: false, feilmelding: "Ugyldig eier." }

  // 5. otherwise: await opprettKapitalinnskudd(prisma, { eiendomId: input.eiendomId, brukerId: input.brukerId, dato, belop: input.belop, beskrivelse: input.beskrivelse });
  //    return { ok: true, data };
}

export async function slettInnskuddAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettKapitalinnskudd(prisma, id);
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === KAPITALINNSKUDD_FEIL) {
      return { ok: false, feilmelding: KAPITALINNSKUDD_FEIL };
    }
    console.error("Uventet feil ved sletting av kapitalinnskudd:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
```

Run the four checks in `registrerInnskuddAction` in the order listed (dato, belop, eiendomId, brukerId) — the test for "avviser når eiendommen ikke finnes" passes a valid dato/belop, and the test for "avviser når brukeren ikke er en registrert eier" passes a valid dato/belop/eiendomId, so an earlier check never masks the one under test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "app/admin/(protected)/boliger/[id]/kapital/actions.test.ts"`

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/boliger/[id]/kapital/actions.ts" "app/admin/(protected)/boliger/[id]/kapital/actions.test.ts"
git commit -m "feat: add registrerInnskuddAction and slettInnskuddAction"
```

---

### Task 3: UI — Kapital-side og panel

**Files:**
- Create: `app/admin/(protected)/boliger/[id]/kapital/page.tsx`
- Create: `app/admin/(protected)/boliger/[id]/kapital/KapitalPanel.tsx`
- Modify: `app/admin/(protected)/boliger/[id]/page.tsx` (add a "Kapital" breadcrumb link next to the existing "Delprosjekter" one)
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx` (add a reciprocal "Kapital" breadcrumb link)

**Interfaces:**
- Consumes: `hentInnskuddForEiendom`, `beregnEierandeler` from `lib/kapitalinnskudd.ts` (Task 1); `registrerInnskuddAction`, `slettInnskuddAction` from `./actions` (Task 2).

- [ ] **Step 1: Build `page.tsx`**

Server component, `export const dynamic = "force-dynamic"` (matches `delprosjekter/page.tsx`). Load `{ id }` from `params`, `notFound()` if the `Bolig` doesn't exist. Fetch:
- `eiere = prisma.adminUser.findMany({ where: { rolle: "eier" }, orderBy: { navn: "asc" } })`
- `innskuddRader = hentInnskuddForEiendom(prisma, eiendomId)`, mapped to `{ id, dato: dato.toISOString().slice(0,10), belop, beskrivelse, brukerId, brukerNavn }` (same ISO-slice pattern as `delprosjekter/page.tsx` does for `timer`)
- `eierandeler = beregnEierandeler(prisma, eiendomId)`

Render three sections in the same `bg-white rounded-xl border border-[var(--border)] p-6` card style as `delprosjekter/page.tsx`:
1. Breadcrumb: `← Tilbake` to `/admin/boliger/${eiendomId}`, then a `/` separator, then the heading `Kapital – {eiendom.tittel}`, then a `/` separator and a link to `/admin/boliger/${eiendomId}/delprosjekter` labeled "Delprosjekter" (same link styling as the existing "Delprosjekter" link in `boliger/[id]/page.tsx`).
2. "Eierandeler" card: a list of `eierandeler`, each row showing `brukerNavn`, and `new Intl.NumberFormat("nb-NO").format(belop) + " kr"` together with `andelProsent.toFixed(1) + " %"`.
3. "Kapitalinnskudd" card: renders `<KapitalPanel eiendomId={eiendomId} eiere={...} innskudd={...} />`.

- [ ] **Step 2: Build `KapitalPanel.tsx`**

Mirror `TimeregistreringPanel.tsx`'s structure exactly (same `"use client"`, `useRouter`, `dagensDatoOslo()`/`formaterDatoNorsk()` helpers, `inputKlasse`/`labelKlasse` constants, try/catch/finally in both handlers clearing loading state in `finally`, derived `effectiveX` pattern for the select so a stale selection can't survive a `router.refresh()`).

```ts
interface KapitalPanelProps {
  eiendomId: number;
  eiere: { id: number; navn: string }[];
  innskudd: { id: number; dato: string; belop: number; beskrivelse: string | null; brukerId: number; brukerNavn: string }[];
}
```

Differences from `TimeregistreringPanel`:
- The select is labeled "Eier *" and lists `eiere` (not delprosjekter); `effectiveBrukerId` derives the same way `effectiveDelprosjektId` does.
- The amount input is labeled "Beløp (kr) *", `type="number"`, `step="1"`, `min="1"` (whole kroner, must be positive — no upper bound, unlike the 24-hour cap on timer entries).
- Submits via `registrerInnskuddAction({ eiendomId, brukerId: Number(effectiveBrukerId), dato, belop: Number(belop), beskrivelse: beskrivelse || undefined })`; on success, call `setDato(dagensDatoOslo())` and reset `belop`/`beskrivelse` to empty — exactly what `TimeregistreringPanel` does with `dato`/`antallTimer`/`beskrivelse` on success. The eier selection (`brukerId`) is **not** reset, so logging several contributions from the same owner in a row doesn't require reselecting them each time. Then `router.refresh()`.
- The list shows each row as `{formaterDatoNorsk(rad.dato)} – {rad.brukerNavn}` with `{new Intl.NumberFormat("nb-NO").format(rad.belop)} kr` and the optional `beskrivelse`, each with a "Slett" button.
- **The "Slett" button is shown on every row, unconditionally** — not gated behind `rad.brukerId === naavarendeBrukerId` the way `TimeregistreringPanel` gates it. This matches Task 1 Step 6's design call: Kapitalinnskudd is shared bookkeeping any of the four co-owner admins may correct, not a personal log tied to its creator. `KapitalPanel` therefore takes no `naavarendeBrukerId` prop.
- Empty state: if `eiere.length === 0`, render `<p className="text-sm text-[var(--muted)]">Ingen eiere registrert.</p>` instead of the form (mirrors the `delprosjekter.length === 0` guard in `TimeregistreringPanel`).

- [ ] **Step 3: Wire up the breadcrumb links**

In `app/admin/(protected)/boliger/[id]/page.tsx`: add, right after the existing `Link` to `/admin/boliger/${bolig.id}/delprosjekter` ("Delprosjekter"), a `/` separator and a second `Link` with the same classes to `/admin/boliger/${bolig.id}/kapital` labeled "Kapital".

In `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx`: add the same kind of reciprocal link to `/admin/boliger/${eiendomId}/kapital` labeled "Kapital" in its breadcrumb row.

- [ ] **Step 4: Manual verification**

Start the dev server (or use the one already running on port 3010 against this worktree's `dev.db`), log in as one of the seeded accounts, open an eiendom's new "Kapital" page via the breadcrumb link, and verify:
- Registering an innskudd for each of the four seeded eiere updates both the "Eierandeler" percentages and the innskudd list.
- Deleting an innskudd entered under a *different* logged-in eier than the current session succeeds (confirms the no-ownership-restriction delete).
- An invalid beløp (`0`) and an invalid dato are both rejected with a visible error and the Lagrer.../Sletter... loading state always clears.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(protected)/boliger/[id]/kapital" "app/admin/(protected)/boliger/[id]/page.tsx" "app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx"
git commit -m "feat: add Kapital page with contribution panel and ownership-share summary"
```
