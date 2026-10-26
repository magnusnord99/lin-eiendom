# Timeregistrering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the four owners log hours worked against a specific eiendom + delprosjekt, see the logged history for an eiendom, and delete their own entries — replacing the "Timelister" sheet in the old spreadsheet.

**Architecture:** A new `Timeregistrering` model FK'd to `Delprosjekt` (which already carries `eiendomId`) and to `AdminUser`. A data-access module (`lib/timeregistrering.ts`) mirrors the existing `lib/delprosjekt.ts` shape. Two self-authenticating Server Actions (added to the existing `delprosjekter/actions.ts`) expose create/delete, reusing the session pattern already established in that file. The existing `delprosjekter/page.tsx` (one page per eiendom, already listing delprosjekter) gains a quick-add form and a list, mirroring the existing `NyttDelprosjektSkjema` pattern. Before any of that: the existing `/api/boliger` write endpoints get a field allowlist, because they currently forward the entire request body to Prisma unfiltered, and the new relation this plan adds turns that into a way to bypass the ownership check being built.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + libsql, NextAuth v4 (existing `krevInnloggetSesjon`/session pattern from `lib/auth.ts`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md` (§7.5 Timeregistrering; §6 and §9 for the individual-login precondition this plan relies on, already built in the Fundament phase).

## Global Constraints

- NOK som valuta, norsk datoformat, Europe/Oslo tidssone. (spec §10)
- Produksjonsklar kode — ikke en visuell prototype. (spec §10)
- Ikke bryte offentlig nettsted eller eksisterende admin-login. (spec §10)
- Rask mobilvennlig registrering er kravet — ikke en live start/stopp-timer i denne omgangen. (spec §7.5)
- Enhver ny Server Action som endrer data må selv kreve en gyldig sesjon (samme mønster som `opprettDelprosjektAction` i `app/admin/(protected)/boliger/[id]/delprosjekter/actions.ts` — sjekk `session?.user?.id`, kast ellers), ikke stole på layout-nivå beskyttelse alene. (etablert i Fundament-fasen, Task 3)
- En bruker kan kun registrere timer på seg selv (`brukerId` settes fra sesjonen, aldri fra klienten) og kan kun slette sine egne registreringer. (bekreftet av eierne: individuelle innlogginger finnes nettopp for per-person timeregistrering)
- `Delprosjekt`↔`Timeregistrering`-relasjonen gjør de eksisterende skriveendepunktene i `app/api/boliger/` farligere (nye nøstede skriveveier via Prisma sin genererte `BoligUpdateInput`/`BoligCreateInput`) med mindre skrivbare felt låses til en eksplisitt liste. Dette gjøres i Task 1, før resten av planen er avhengig av relasjonen.
- En kastet feil fra en Server Action vises ikke med sin egen melding til brukeren i en produksjonsbygget Next.js-app (den ersattes med en generisk feil). Forventede valideringsfeil (ugyldig antall timer, ugyldig dato, "ikke din registrering") må derfor returneres som en verdi, ikke kastes — kun mangel på innlogging kastes fortsatt, siden det aldri skal kunne skje gjennom den vanlige UI-flyten.

## Review Focus

- Et PUT/POST-kall mot det eksisterende `/api/boliger`-endepunktet med et nøstet relasjonsfelt (f.eks. `delprosjekter.update.data.timeregistreringer.deleteMany`) må aldri nå databasen — dagens endepunkter videresender hele requestbody urenset til Prisma. → Task 1.
- Null, negativt eller absurd høyt `antallTimer` (f.eks. -5, 0, 1000) må avvises med en tydelig feilmelding, ikke lagres eller krasje. → Task 3.
- Et `delprosjektId` som faktisk hører til en *annen* eiendom enn den URL-en/formen oppgir (manipulert input) må avvises, ikke lagre en registrering som krysser eiendomsgrenser. → Task 3.
- Å slette en annen brukers registrering må avvises (samme feilmelding som "finnes ikke", for å ikke lekke at raden finnes), ikke stille lykkes. → Task 2.
- En ugyldig, manglende eller umulig dato (tom streng, `null`, "2026-02-30", et fullt tidsstempel) må gi en forståelig feil og aldri lagres som en forskjøvet eller gjettet kalenderdag. → Task 3.
- Et uautentisert kall til en av de to nye Server Actions må kastes ut, akkurat som det eksisterende mønsteret i samme fil. → Task 3.
- Et manglende, `undefined` eller feilformet (f.eks. et objekt) `id` til slette-handlingen må avvises uten å kalle databasen — ikke stille slette alt den innloggede brukeren eier, siden Prisma dropper `undefined`-felt fra et `where`-filter i stedet for å feile. → Task 2.

---

### Task 1: Lås ned hvilke felt `/api/boliger`-endepunktene kan skrive

**Files:**
- Modify: `lib/eiendom.ts`
- Modify: `lib/eiendom.test.ts`
- Modify: `app/api/boliger/route.ts`
- Modify: `app/api/boliger/route.test.ts`
- Modify: `app/api/boliger/[id]/route.ts`
- Modify: `app/api/boliger/[id]/route.test.ts`

**Interfaces:**
- Consumes: nothing new — this task only adds a filter in front of the existing `prisma.bolig.create`/`update`/`updateMany` calls in the two route files.
- Produces: `plukkSkrivbareBoligFelter(input: Record<string, unknown>): Record<string, unknown>` from `lib/eiendom.ts`, used by both route files. No later task depends on this directly, but every later task's guarantees (ownership of time entries) depend on this closing the hole.

- [ ] **Step 1: Write the failing tests in `lib/eiendom.test.ts`**

```typescript
import { plukkSkrivbareBoligFelter } from "./eiendom";

describe("plukkSkrivbareBoligFelter", () => {
  it("beholder alle tillatte felt, inkludert null- og false-verdier", () => {
    const resultat = plukkSkrivbareBoligFelter({ tittel: "A", pris: null, aktiv: false });
    expect(resultat).toEqual({ tittel: "A", pris: null, aktiv: false });
  });

  it("fjerner relasjonsfelt og ukjente felt", () => {
    const resultat = plukkSkrivbareBoligFelter({
      tittel: "A",
      delprosjekter: { create: [{ navn: "Hack" }] },
      ukjentFelt: "noe",
    });
    expect(resultat).toEqual({ tittel: "A" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run lib/eiendom.test.ts`
Expected: FAIL ("plukkSkrivbareBoligFelter is not exported" or similar).

- [ ] **Step 3: Implement `plukkSkrivbareBoligFelter` in `lib/eiendom.ts`**

```typescript
export const SKRIVBARE_BOLIG_SKALARFELTER = [
  "tittel", "adresse", "by", "pris", "type", "storrelse", "rom", "bad",
  "beskrivelse", "bilder", "lat", "lng", "aktiv", "status",
  "kjopesum", "kjopsdato", "finansiering", "estimertVerdiNa", "estimertVerdiEtterOppussing",
] as const;

export function plukkSkrivbareBoligFelter(input: Record<string, unknown>): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  for (const felt of SKRIVBARE_BOLIG_SKALARFELTER) {
    if (felt in input) resultat[felt] = input[felt];
  }
  return resultat;
}
```

This is every scalar `Bolig` column except `id`, `opprettet`, `oppdatert` (server-managed) — deliberately including `kjopesum`/`kjopsdato`/`finansiering`/`estimertVerdiNa`/`estimertVerdiEtterOppussing`, which have no UI yet but are legitimate future-writable columns, not relations.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run lib/eiendom.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `app/api/boliger/route.ts` (POST) and add a regression test**

In `POST`, replace `const data = await req.json();` with:

```typescript
import { plukkSkrivbareBoligFelter } from "@/lib/eiendom";
import { Prisma } from "@/app/generated/prisma/client";
// ...
const data = plukkSkrivbareBoligFelter(await req.json());
```

and change the final call to `prisma.bolig.create({ data: data as unknown as Prisma.BoligCreateInput })`. Everything else in the function (the `resolverEffektivStatus`/`validerStatusForSkriving` calls, which only read/write `data.status`/`data.type`) stays unchanged.

Add to `app/api/boliger/route.test.ts` (this file's existing mock session has no `user.id` and currently only exercises the 401 path — import `getServerSession` from `"next-auth"` at the top so this new test can override it per-call):

```typescript
import { getServerSession } from "next-auth";
// ...
it("fjerner relasjonsfelt og ukjente felt før oppretting", async () => {
  vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" }, expires: "" } as never);
  prismaMock.bolig.create.mockResolvedValue({ id: 1 });

  const req = new Request("http://localhost/api/boliger", {
    method: "POST",
    body: JSON.stringify({
      tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "",
      delprosjekter: { create: [{ navn: "Hack" }] },
    }),
  });

  await POST(req as any);

  expect(prismaMock.bolig.create).toHaveBeenCalledTimes(1);
  expect(prismaMock.bolig.create.mock.calls[0][0].data).not.toHaveProperty("delprosjekter");
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx vitest run app/api/boliger/route.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 7: Wire it into `app/api/boliger/[id]/route.ts` (PUT) and add a regression test**

In `PUT`, change `const { forventetStatus, forventetType, ...data } = await req.json();` to:

```typescript
import { plukkSkrivbareBoligFelter } from "@/lib/eiendom";
// ...
const { forventetStatus, forventetType, ...raw } = await req.json();
const data = plukkSkrivbareBoligFelter(raw);
```

Keep `data` as the plain `Record<string, unknown>` that `plukkSkrivbareBoligFelter` returns — do **not** annotate or cast it to `Prisma.BoligUpdateInput` at this point. `resolverEffektivStatus(data, eksisterende)` (unchanged below this) requires `type?: string`, but `Prisma.BoligUpdateInput["type"]` is `string | StringFieldUpdateOperationsInput | undefined`; assigning the narrower-typed variable there would fail to compile. Instead, add the cast only at each of the two existing Prisma call sites that pass `data` as the `data:` option — `prisma.bolig.update({ where: { id }, data: data as Prisma.BoligUpdateInput })` and `prisma.bolig.updateMany({ where: {...}, data: data as Prisma.BoligUpdateInput })` — leaving every other line (the `where` clauses, the `resolverEffektivStatus`/`validerStatusForSkriving` calls, `data.status =`/`data.type =`) untouched.

Add to `app/api/boliger/[id]/route.test.ts`, in the `describe("PUT /api/boliger/[id]", ...)` block (this file's mock session already has `user.id`, so no mock changes needed):

```typescript
it("fjerner relasjonsfelt (f.eks. forsøk på å slette andres timeregistreringer) før oppdatering", async () => {
  prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "til_salgs", type: "salg" });
  prismaMock.bolig.update.mockResolvedValue({ id: 1 });

  const req = new Request("http://localhost/api/boliger/1", {
    method: "PUT",
    body: JSON.stringify({
      tittel: "x",
      delprosjekter: { update: { where: { id: 1 }, data: { timeregistreringer: { deleteMany: { brukerId: 2 } } } } },
    }),
  });

  await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

  expect(prismaMock.bolig.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { tittel: "x" } });
});
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run app/api/boliger/\[id\]/route.test.ts`
Expected: PASS, all tests (existing + new) — the pre-existing concurrency/409/400 tests must still pass unchanged, since the allowlist preserves every field they already send (`status`, `type`, `tittel`, `forventetStatus`, `forventetType`).

- [ ] **Step 9: Run the full suite and commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass, no type errors.

```bash
git add lib/eiendom.ts lib/eiendom.test.ts app/api/boliger/route.ts app/api/boliger/route.test.ts app/api/boliger/\[id\]/route.ts app/api/boliger/\[id\]/route.test.ts
git commit -m "fix: allowlist writable Bolig fields on the API routes to block nested-relation writes"
```

---

### Task 2: Datamodell og datalag

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev --name legg_til_timeregistrering`
- Create: `lib/timeregistrering.ts`
- Create: `lib/timeregistrering.test.ts`

**Interfaces:**
- Consumes: `PrismaClient`, `Delprosjekt` relation from `app/generated/prisma/client` (existing); `createTestDb` from `tests/helpers/testDb.ts` (existing, used by `lib/delprosjekt.test.ts`).
- Produces (for Task 3):
  - `opprettTimeregistrering(prisma: PrismaClient, input: { delprosjektId: number; brukerId: number; dato: Date; antallTimer: number; beskrivelse?: string }): Promise<Timeregistrering>`
  - `hentTimerForEiendom(prisma: PrismaClient, eiendomId: number): Promise<Array<{ id: number; dato: Date; antallTimer: number; beskrivelse: string | null; delprosjektId: number; delprosjektNavn: string; brukerId: number; brukerNavn: string }>>` — newest `dato` first.
  - `TIMEREGISTRERING_EIER_FEIL: string` — the fixed message `"Fant ikke registrering, eller du har ikke tilgang til å slette den."`, exported so Task 3 can recognize this specific, expected failure and distinguish it from an unexpected one.
  - `slettTimeregistrering(prisma: PrismaClient, id: number, brukerId: number): Promise<void>` — throws `new Error(TIMEREGISTRERING_EIER_FEIL)` when `id` is not a positive integer (guards against a missing/`undefined`/object/non-integer `id` reaching the database — `undefined` is silently dropped from a Prisma `where` filter, and an object like `{ gt: 0 }` becomes a filter operator, either of which would otherwise match or delete far more than one row), or when no row matched both `id` and `brukerId`.

- [ ] **Step 1: Add the `Timeregistrering` model and its relations to `prisma/schema.prisma`**

```prisma
model Timeregistrering {
  id            Int         @id @default(autoincrement())
  delprosjektId Int
  delprosjekt   Delprosjekt @relation(fields: [delprosjektId], references: [id])
  brukerId      Int
  bruker        AdminUser   @relation(fields: [brukerId], references: [id])
  dato          DateTime
  antallTimer   Float
  beskrivelse   String?
  opprettet     DateTime    @default(now())
  oppdatert     DateTime    @updatedAt
}
```

Add `timeregistreringer Timeregistrering[]` to both the `Delprosjekt` and `AdminUser` models.

- [ ] **Step 2: Generate the migration, apply it, and regenerate the Prisma client**

Run: `npx prisma migrate dev --name legg_til_timeregistrering`
Expected: a new migration directory under `prisma/migrations/` containing `CREATE TABLE "Timeregistrering"`.

Then run: `npx prisma generate`
Expected: exits cleanly. This step is required and not implied by the previous one — the installed Prisma 7 CLI's `migrate dev` applies the migration but does not regenerate the client, so skipping this leaves `PrismaClient` with no `timeregistrering` delegate and no `Timeregistrering` type, breaking every later step in this plan with confusing errors instead of a clear one.

- [ ] **Step 3: Write the failing tests in `lib/timeregistrering.test.ts`**

Follow the exact structure of `lib/delprosjekt.test.ts` (same `createTestDb` helper, same inline `prisma.bolig.create`/`prisma.delprosjekt.create`/`prisma.adminUser.create` fixtures — the `AdminUser.passord` field is required, any placeholder hash string is fine in tests since `verifyPassword` is not exercised here).

```typescript
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { opprettTimeregistrering, hentTimerForEiendom, slettTimeregistrering } from "./timeregistrering";

describe("opprettTimeregistrering og hentTimerForEiendom", () => {
  it("lagrer en registrering og henter den tilbake med navn på bruker og delprosjekt", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "Karl Johns Veg", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });

    await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date("2026-10-20T00:00:00.000Z"), antallTimer: 4.5, beskrivelse: "Montering" });

    const timer = await hentTimerForEiendom(prisma, eiendom.id);
    expect(timer).toHaveLength(1);
    expect(timer[0].antallTimer).toBe(4.5);
    expect(timer[0].brukerNavn).toBe("Magnus");
    expect(timer[0].delprosjektNavn).toBe("Kjøkken");
  });

  it("sorterer nyeste dato først", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });

    await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date("2026-10-10T00:00:00.000Z"), antallTimer: 1 });
    await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date("2026-10-20T00:00:00.000Z"), antallTimer: 2 });

    const timer = await hentTimerForEiendom(prisma, eiendom.id);
    expect(timer.map((t) => t.antallTimer)).toEqual([2, 1]);
  });
});

describe("slettTimeregistrering", () => {
  it("sletter registreringen når brukeren eier den", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });
    const reg = await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date(), antallTimer: 2 });

    await slettTimeregistrering(prisma, reg.id, bruker.id);

    expect(await prisma.timeregistrering.count()).toBe(0);
  });

  it("kaster feil når en annen bruker enn eieren forsøker å slette", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });
    const andre = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein" } });
    const reg = await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: eier.id, dato: new Date(), antallTimer: 2 });

    await expect(slettTimeregistrering(prisma, reg.id, andre.id)).rejects.toThrow(/finnes ikke|tilgang/i);
    expect(await prisma.timeregistrering.count()).toBe(1);
  });

  it("kaster feil for et ugyldig id i stedet for å slette bredt (undefined eller et objekt)", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });
    await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date(), antallTimer: 2 });
    await opprettTimeregistrering(prisma, { delprosjektId: delprosjekt.id, brukerId: bruker.id, dato: new Date(), antallTimer: 3 });

    await expect(slettTimeregistrering(prisma, undefined as unknown as number, bruker.id)).rejects.toThrow(/finnes ikke|tilgang/i);
    await expect(slettTimeregistrering(prisma, { gt: 0 } as unknown as number, bruker.id)).rejects.toThrow(/finnes ikke|tilgang/i);
    expect(await prisma.timeregistrering.count()).toBe(2);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/timeregistrering.test.ts`
Expected: FAIL with "Cannot find module './timeregistrering'" or similar.

- [ ] **Step 5: Implement `lib/timeregistrering.ts`**

Implement the functions and constant from the Interfaces block above. `hentTimerForEiendom` queries through the `delprosjekt` relation (`where: { delprosjekt: { eiendomId } }`), includes `delprosjekt` and `bruker`, orders by `dato: "desc"`, and maps each row to the flat shape (`delprosjektNavn: row.delprosjekt.navn`, `brukerNavn: row.bruker.navn`). `slettTimeregistrering` first checks `Number.isInteger(id) && id > 0` and throws `TIMEREGISTRERING_EIER_FEIL` immediately if not (before touching the database), then uses `prisma.timeregistrering.deleteMany({ where: { id, brukerId } })` and throws the same constant when `result.count === 0` — mirroring the `updateMany`-then-check-count idiom already used in `app/api/boliger/[id]/route.ts` for optimistic concurrency. Using one constant for both cases is deliberate: it keeps "invalid id" indistinguishable from "not yours" to callers, for the same reason the delete endpoint elsewhere in this codebase doesn't reveal which case occurred.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/timeregistrering.test.ts`
Expected: PASS, all 4 tests.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/timeregistrering.ts lib/timeregistrering.test.ts
git commit -m "feat: add Timeregistrering model and data-access layer"
```

---

### Task 3: Server Actions

**Files:**
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/actions.ts`
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/actions.test.ts`

**Interfaces:**
- Consumes: `opprettTimeregistrering`, `slettTimeregistrering`, `TIMEREGISTRERING_EIER_FEIL` from `lib/timeregistrering.ts` (Task 2); `authOptions` from `lib/auth.ts`; `prisma` from `lib/prisma.ts`; the existing `getServerSession`/`vi.mock` pattern already in `actions.test.ts`.
- Produces (for Task 4):
  - `type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string }`
  - `registrerTimerAction(input: { eiendomId: number; delprosjektId: number; dato: string; antallTimer: number; beskrivelse?: string }): Promise<HandlingResultat<Timeregistrering>>` — `dato` is an ISO `yyyy-mm-dd` string, as produced by an `<input type="date">`. Throws (does not return `ok: false`) only when there is no session.
  - `slettTimeregistreringAction(id: number): Promise<HandlingResultat<null>>` — same throw-only-on-no-session rule.

**Why a result value instead of a thrown error for validation/ownership failures:** a Server Action's thrown error message is not reliably shown to the end user in a production Next.js build (it gets replaced with a generic message) — only its own return value survives intact. Missing-session is different: it can't happen through the normal UI (the page is already behind the authenticated layout), so there is no user-facing message to protect and the existing thrown-error convention from `opprettDelprosjektAction` is kept as-is for it.

- [ ] **Step 1: Write the failing tests, appended to `actions.test.ts`**

```typescript
import { registrerTimerAction, slettTimeregistreringAction } from "./actions";

describe("registrerTimerAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(
      registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 4 })
    ).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettTimeregistreringAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettTimeregistreringAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});
```

These two reuse the existing top-of-file `vi.mock("next-auth", ...)` returning a null session. The remaining Review Focus cases need a *signed-in* mock session — add `import { getServerSession } from "next-auth";` to the test file (so `vi.mocked(getServerSession)` can override the mocked module per test) and a second `describe` block:

```typescript
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

describe("registrerTimerAction med innlogget sesjon", () => {
  it("avviser antallTimer utenfor 0–24", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 0 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/timer/i);
  });

  it("avviser manglende dato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: null as unknown as string, antallTimer: 4 });
    expect(resultat.ok).toBe(false);
  });

  it("avviser en kalenderdato som ikke finnes (2026-02-30)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-02-30", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser en tidsstempel-streng i stedet for en ren kalenderdato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20T23:00:00.000Z", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser når delprosjektet hører til en annen eiendom", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { delprosjekt: { findUnique: ReturnType<typeof vi.fn> } }).delprosjekt = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, eiendomId: 2 }),
    };
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/finnes ikke/i);
  });
});

describe("slettTimeregistreringAction med innlogget sesjon", () => {
  it("avviser et manglende id uten å kalle databasen", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await slettTimeregistreringAction(undefined as unknown as number);
    expect(resultat.ok).toBe(false);
  });
});
```

The last test relies on `slettTimeregistrering`'s own `Number.isInteger` guard (Task 2) rejecting the id before any `prisma.timeregistrering.*` call — this file's `prisma` mock is `{}` with no `timeregistrering` property, so the test would fail with a different error if that guard were ever removed, which is exactly the regression it's meant to catch.

Adjust the mock wiring to match whatever `vi.mock("next-auth", ...)` shape the implementer finds already in the file — the point of each test is the assertion, not the exact mock mechanics. `prisma` is mocked as `{}` in this file already, so assigning `.delprosjekt` onto it at runtime (as above) is safe.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.test.ts`
Expected: FAIL (functions not exported yet).

- [ ] **Step 3: Implement the two actions in `actions.ts`**

```typescript
export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function registrerTimerAction(input: {
  eiendomId: number;
  delprosjektId: number;
  dato: string;
  antallTimer: number;
  beskrivelse?: string;
}): Promise<HandlingResultat<Timeregistrering>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  if (typeof input.dato !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dato)) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }
  const dato = new Date(`${input.dato}T00:00:00.000Z`);
  if (Number.isNaN(dato.getTime()) || dato.toISOString().slice(0, 10) !== input.dato) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }

  if (!Number.isFinite(input.antallTimer) || input.antallTimer <= 0 || input.antallTimer > 24) {
    return { ok: false, feilmelding: "Antall timer må være mellom 0 og 24." };
  }

  const delprosjekt = await prisma.delprosjekt.findUnique({ where: { id: input.delprosjektId } });
  if (!delprosjekt || delprosjekt.eiendomId !== input.eiendomId) {
    return { ok: false, feilmelding: "Delprosjektet finnes ikke på denne eiendommen." };
  }

  const data = await opprettTimeregistrering(prisma, {
    delprosjektId: input.delprosjektId,
    brukerId: Number(session.user.id),
    dato,
    antallTimer: input.antallTimer,
    beskrivelse: input.beskrivelse,
  });
  return { ok: true, data };
}

export async function slettTimeregistreringAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettTimeregistrering(prisma, id, Number(session.user.id));
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === TIMEREGISTRERING_EIER_FEIL) {
      return { ok: false, feilmelding: TIMEREGISTRERING_EIER_FEIL };
    }
    console.error("Uventet feil ved sletting av timeregistrering:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
```

Import `TIMEREGISTRERING_EIER_FEIL` from `lib/timeregistrering.ts` alongside `opprettTimeregistrering`/`slettTimeregistrering`. The `id` validation itself lives in `slettTimeregistrering` (Task 2) — this action never needs its own separate check, since every rejection path from that function (invalid id, or a real ownership/not-found miss) already throws the exact same recognized message, which this `catch` maps back to a result instead of letting it fall through to Next.js's generic production error text (TR-09): anything *other* than that one known message is logged server-side and replaced with a generic message, so a real database failure never leaks internal diagnostics to the client.

The `${input.dato}T00:00:00.000Z` + round-trip comparison is what rejects "2026-02-30": `Date` silently normalizes it to a real calendar day (e.g. March), so `.getTime()` is not `NaN`, but re-formatting back to `yyyy-mm-dd` no longer equals the original string, and the mismatch is caught.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.test.ts`
Expected: PASS, all tests (existing + new).

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.ts app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.test.ts
git commit -m "feat: add registrerTimerAction and slettTimeregistreringAction"
```

---

### Task 4: UI — quick-add form and list on the delprosjekter page

**Files:**
- Create: `app/admin/(protected)/boliger/[id]/delprosjekter/TimeregistreringPanel.tsx`
- Modify: `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx`

**Interfaces:**
- Consumes: `registrerTimerAction`, `slettTimeregistreringAction`, `HandlingResultat<T>` (Task 3); `hentTimerForEiendom` (Task 2); `getServerSession`/`authOptions` (existing, same import already used elsewhere in the admin area).
- Produces: nothing consumed by a later task — this is the last task in this plan.

- [ ] **Step 1: Fetch what the panel needs in `page.tsx`**

Alongside the existing `eiendom` fetch, add:

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hentTimerForEiendom } from "@/lib/timeregistrering";
```

```typescript
const session = await getServerSession(authOptions);
const naavarendeBrukerId = Number(session?.user?.id);
const timerRader = await hentTimerForEiendom(prisma, eiendomId);
const timer = timerRader.map((t) => ({
  id: t.id,
  dato: t.dato.toISOString().slice(0, 10),
  antallTimer: t.antallTimer,
  beskrivelse: t.beskrivelse,
  delprosjektNavn: t.delprosjektNavn,
  brukerId: t.brukerId,
  brukerNavn: t.brukerNavn,
}));
```

`t.dato` was stored as UTC midnight of the submitted calendar day by `registrerTimerAction` (Task 3), so `.toISOString().slice(0, 10)` reproduces the exact same `yyyy-mm-dd` the user entered — no timezone drift at this step.

Render a new card, after the "Eksisterende delprosjekter" card, following the existing card markup (`bg-white rounded-xl border border-[var(--border)] p-6`):

```tsx
<div className="bg-white rounded-xl border border-[var(--border)] p-6 mt-8">
  <h2 className="font-semibold text-[var(--foreground)] mb-5">Timeregistrering</h2>
  <TimeregistreringPanel
    eiendomId={eiendomId}
    delprosjekter={eiendom.delprosjekter.map((d) => ({ id: d.id, navn: d.navn }))}
    timer={timer}
    naavarendeBrukerId={naavarendeBrukerId}
  />
</div>
```

- [ ] **Step 2: Implement `TimeregistreringPanel.tsx`**

A client component (`"use client"`), same shape as `NyttDelprosjektSkjema.tsx`: local `useState` for the form fields (`delprosjektId` as a string, initialized to `""`; `dato` defaulting to today's calendar date **in Europe/Oslo**, not UTC — see below; `antallTimer`, `beskrivelse`), a `laster`/`feil` pair, and a `handleSubmit` that calls `registrerTimerAction`, checks the returned `HandlingResultat`, and either resets the form + `router.refresh()` (on `ok: true`) or `setFeil(resultat.feilmelding)` (on `ok: false`) — copy the loading-state/try-catch-around-the-await shape from `NyttDelprosjektSkjema.tsx`, but branch on the result instead of catching a thrown error, since this action no longer throws for expected validation failures.

Today's date, computed in Europe/Oslo instead of the browser/server's UTC day (`new Date().toISOString().slice(0, 10)` is wrong here — e.g. at 00:30 local time in Ålesund it would silently default to *yesterday*):

```typescript
function dagensDatoOslo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}
```

(`en-CA` formats as `yyyy-mm-dd` directly — no manual reassembly needed.)

The currently selected delprosjekt must track the live `delprosjekter` prop, not just its value at the moment the form first mounted — `NyttDelprosjektSkjema`'s `router.refresh()` re-fetches server data but does not reset this component's `useState`, so if the panel first renders with an empty `delprosjekter` list (brand new eiendom), the stored selection stays `""` even after the first delprosjekt is created and the list becomes non-empty. Compute the value actually used, both for the `<select>`'s `value` prop and at submit time, instead of reading the raw state directly:

```typescript
const effectiveDelprosjektId = delprosjekter.some((d) => String(d.id) === delprosjektId)
  ? delprosjektId
  : String(delprosjekter[0]?.id ?? "");
```

Use `effectiveDelprosjektId` for the `<select value={...}>` and `Number(effectiveDelprosjektId)` in the submit payload; keep `onChange` writing the raw user selection to `delprosjektId` state as usual.

Below the form, render the `timer` list (already newest-first from the server): each row shows `dato` formatted as a Norwegian date via plain string slicing (no `Date` round-trip, so no timezone can be reintroduced):

```typescript
function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}
```

...plus `delprosjektNavn`, `antallTimer` + " t", `brukerNavn`, `beskrivelse` (if present), and — only when `rad.brukerId === naavarendeBrukerId` — a "Slett" button that calls `slettTimeregistreringAction(rad.id)`, checks the returned `HandlingResultat` the same way as the form (set a local error state on `ok: false`, `router.refresh()` on `ok: true`), with its own small loading state local to that row (a `slettendeId` state is enough — no need for a full form library). When `delprosjekter` is empty, render the same "Ingen delprosjekter registrert." empty-state text instead of a form, since there is nothing to log time against yet.

Props type:

```typescript
interface TimeregistreringPanelProps {
  eiendomId: number;
  delprosjekter: { id: number; navn: string }[];
  timer: { id: number; dato: string; antallTimer: number; beskrivelse: string | null; delprosjektNavn: string; brukerId: number; brukerNavn: string }[];
  naavarendeBrukerId: number;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npx next dev`), log in as a seeded user, open an eiendom's delprosjekter page, and confirm: (a) logging an entry against a real delprosjekt appears in the list immediately after refresh, with a Norwegian-formatted date; (b) creating the very first delprosjekt on a brand-new eiendom and immediately logging time against it (no full page reload in between) submits against that delprosjekt, not a stale/empty selection; (c) the "Slett" button appears only on your own rows; (d) deleting your own row removes it; (e) submitting 0 or a negative number of hours shows the inline error instead of submitting; (f) the default date shown matches "today" in Norway even if the machine running the dev server is in a different timezone (check the system clock/timezone used by the dev environment before concluding this one either way).

- [ ] **Step 5: Commit**

```bash
git add app/admin/\(protected\)/boliger/\[id\]/delprosjekter/TimeregistreringPanel.tsx app/admin/\(protected\)/boliger/\[id\]/delprosjekter/page.tsx
git commit -m "feat: add time-logging panel to the delprosjekter page"
```
