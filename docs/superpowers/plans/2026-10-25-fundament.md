# Fundament — individuelle kontoer, Eiendom-status og Delprosjekt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Erstatte delt admin-login med individuelle eierkontoer, utvide `Bolig` med en status-styrt eiendoms-livssyklus, og legge til en `Delprosjekt`-modell — fundamentet alle senere faser (timeregistrering, utgifter, kapital, kalender) bygger på.

**Architecture:** Bygger videre på eksisterende Next.js 16 App Router + Prisma 7/libsql + NextAuth v4-stack. `AdminUser`-modellen (allerede i skjemaet, men ubrukt) kobles til `CredentialsProvider` med bcrypt-hashet passord i stedet for miljøvariabler. `Bolig` utvides med et `status`-felt som styrer offentlig synlighet (erstatter `aktiv` i de offentlige queryene). Ny `Delprosjekt`-modell refererer til `Bolig` via `eiendomId`.

**Tech Stack:** Next.js 16, Prisma 7 (libsql/SQLite), NextAuth v4, bcryptjs (ny), Vitest + tsx (nye, for test-tooling — ingen testrammeverk finnes i dag).

**Spec:** `docs/superpowers/specs/2026-10-25-eiendomsplattform-design.md`

## Global Constraints

- NOK som valuta, norsk datoformat, Europe/Oslo tidssone i all ny kode (spec §10).
- Produksjonsklar kode, ikke visuell prototype (spec §10).
- Det offentlige nettstedet (forside, `/boliger`, kontaktformular) skal aldri være i en tilstand der det viser feil data eller feiler, heller ikke midt i denne overgangen (spec §10, §2).
- Ingen overgangsperiode med både gammel delt admin-login og nye individuelle kontoer aktive samtidig (spec §9 — fases ut i samme slutt).
- De fire kontoene seedes manuelt i databasen, ingen selvregistrering/invitasjonsflyt (spec §9).

## Review Focus

Oppdatert etter en claudex-runde (Codex, se `2026-10-25-fundament-REVIEW-LOG.md`) som fant flere konkrete hull i det første utkastet — de fem viktigste er nå:

- **En allerede utstedt admin-sesjon (den gamle delte kontoen) må ikke forbli gyldig etter at `authorize` er byttet ut** — NextAuth kaller ikke `authorize` på nytt for en eksisterende JWT-cookie, så uten en egen ugyldiggjøring ville alle som var innlogget da overgangen skjedde, fortsette å være "innlogget" uten noen reell `AdminUser`-tilknytning — testet i Task 3 (`authVersion`-stempling og -sjekk).
- **Ingen uautentisert leser skal kunne se interne felt** (`kjopesum`, `kjopsdato`, `finansiering`, estimerte verdier) eller en eiendom som ikke er offentlig synlig, via noen av de syv lesestedene (`/`, `/boliger`, `/salg`, `/leie`, begge detaljsidene, `GET /api/boliger[/id]`) — testet i Task 7 (`hentOffentligSynligeBoliger`/`hentOffentligSynligBolig` med en explisitt feltprojeksjon, brukt av alle sju).
- **En Server Action beskyttes ikke av at siden den ligger på krever innlogging** — `opprettDelprosjektAction` må selv sjekke sesjonen — testet i Task 8.
- **Statusskriving må valideres på alle skrivesteder** (tom streng, ukjent verdi, eller en status som ikke passer eiendommens type må avvises med en tydelig feil, ikke lagres stille) — testet i Task 7 (`validerStatusForSkriving`).
- **Statusmigreringen (backfill) må kunne kjøres nøyaktig én gang og aldri overskrive en eiers manuelle statusendring ved et uhell** — løst ved å lime backfillen inn i selve Prisma-migreringen (migrerings-tracket, ikke et gjenkjørbart script) — testet i Task 6 (konsistens mellom SQL og `utledStatusFraAktiv`), med en manuell før/etter-kontroll av synlige eiendoms-IDer ved faktisk utrulling.

---

## Task 1: Test-tooling + passord-hash-utility

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/helpers/testDb.ts`
- Create: `lib/password.ts`
- Test: `lib/password.test.ts`
- Modify: `package.json` (devDependencies: `vitest`, `tsx`; dependencies: `bcryptjs`, `@types/bcryptjs`; scripts: `"test": "vitest run"`)

**Interfaces:**
- Produces: `hashPassword(plaintext: string): Promise<string>`, `verifyPassword(plaintext: string, hash: string): Promise<boolean>` in `lib/password.ts` — brukes av Task 2 (seed) og Task 3 (auth).
- Produces: `createTestDb(): Promise<PrismaClient>` in `tests/helpers/testDb.ts` — oppretter en frisk temp-SQLite-database, kjører `prisma migrate deploy` mot den, og returnerer en `PrismaClient` koblet til den. Brukes av Task 2–8s integrasjonstester.

- [ ] **Step 1: Installer avhengigheter**

Run: `npm install -D vitest tsx && npm install bcryptjs && npm install -D @types/bcryptjs`

- [ ] **Step 2: Legg til `vitest.config.ts`** med `test.environment = "node"` og alias `@` → prosjektrot (samme som `tsconfig.json`s `paths`).

- [ ] **Step 3: Legg til `"test": "vitest run"` i `package.json`s `scripts`.**

- [ ] **Step 4: Skriv feilende test for `hashPassword`/`verifyPassword`**

```ts
// lib/password.test.ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes so the stored value never equals the plaintext", async () => {
    const hash = await hashPassword("hemmelig123");
    expect(hash).not.toBe("hemmelig123");
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("hemmelig123");
    await expect(verifyPassword("hemmelig123", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against the hash", async () => {
    const hash = await hashPassword("hemmelig123");
    await expect(verifyPassword("feil-passord", hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 5: Kjør testen, bekreft at den feiler**

Run: `npx vitest run lib/password.test.ts`
Expected: FAIL with "Cannot find module './password'" eller lignende.

- [ ] **Step 6: Implementer `hashPassword`/`verifyPassword` i `lib/password.ts`** med `bcryptjs`, saltrunder 12.

- [ ] **Step 7: Kjør testen, bekreft at den passerer**

Run: `npx vitest run lib/password.test.ts`
Expected: PASS (3 tester).

- [ ] **Step 8: Implementer `tests/helpers/testDb.ts`**

Bruk `node:child_process.execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: dbUrl } })` mot en midlertidig filbane laget med `node:fs.mkdtempSync(path.join(os.tmpdir(), "yappuccino-test-"))`, deretter opprett og returner en `PrismaClient` (samme adapter-mønster som `lib/prisma.ts`) koblet til `dbUrl`. Ingen egen test for denne — den verifiseres implisitt av Task 2s integrasjonstest.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts tests/helpers/testDb.ts lib/password.ts lib/password.test.ts package.json package-lock.json
git commit -m "test: add vitest tooling and password hashing utility"
```

---

## Task 2: AdminUser-modell — navn, rolle og migrering

**Files:**
- Modify: `prisma/schema.prisma` (AdminUser: legg til `navn String` og `rolle String @default("eier")`)
- Create: `prisma/migrations/<timestamp>_adminuser_navn_rolle/migration.sql` (generert av `prisma migrate dev`)
- Test: `prisma/schema.test.ts`

**Interfaces:**
- Consumes: `createTestDb()` fra Task 1.
- Produces: `AdminUser { id, brukernavn, passord, navn, rolle, opprettet }` — brukes av Task 3 (auth) og Task 4 (seed).

- [ ] **Step 1: Skriv feilende test som forventer de nye feltene**

```ts
// prisma/schema.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";

describe("AdminUser", () => {
  it("stores navn and rolle with a default role of eier", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: "hash", navn: "Magnus Nordmo" },
    });
    expect(bruker.navn).toBe("Magnus Nordmo");
    expect(bruker.rolle).toBe("eier");
  });
});
```

- [ ] **Step 2: Kjør testen, bekreft at den feiler**

Run: `npx vitest run prisma/schema.test.ts`
Expected: FAIL (Prisma validation error: unknown argument `navn`).

- [ ] **Step 3: Legg til feltene i `prisma/schema.prisma`**

```prisma
model AdminUser {
  id         Int      @id @default(autoincrement())
  brukernavn String   @unique
  passord    String
  navn       String
  rolle      String   @default("eier")
  opprettet  DateTime @default(now())
}
```

- [ ] **Step 4: Generer migrering og regenerer klienten**

Run: `npx prisma migrate dev --name adminuser_navn_rolle && npx prisma generate`
Expected: ny mappe i `prisma/migrations/`. Kjør `generate` eksplisitt — den installerte Prisma 7-versjonen av `migrate dev` returnerer uten selv å trigge kode-generering, så `app/generated/prisma` regenereres ikke automatisk.

- [ ] **Step 5: Kjør testen, bekreft at den passerer**

Run: `npx vitest run prisma/schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/schema.test.ts app/generated
git commit -m "feat: add navn and rolle to AdminUser"
```

---

## Task 3: Credentials-provider validerer mot AdminUser, og ugyldiggjør gamle sesjoner

**Files:**
- Modify: `lib/auth.ts`
- Modify: `app/admin/(protected)/layout.tsx` (guard: `session?.user?.id` i stedet for `session`)
- Modify: `app/api/boliger/route.ts` (POST bruker `krevInnloggetSesjon`)
- Modify: `app/api/boliger/[id]/route.ts` (PUT og DELETE bruker `krevInnloggetSesjon`)
- Modify: `app/api/upload/route.ts` (POST bruker `krevInnloggetSesjon`)
- Create: `types/next-auth.d.ts`
- Test: `lib/auth.test.ts`, `app/api/boliger/route.test.ts`, `app/api/upload/route.test.ts`

**Interfaces:**
- Consumes: `verifyPassword` (Task 1), `AdminUser` (Task 2), `createTestDb()` (Task 1).
- Produces i `lib/auth.ts`: `authOptions.providers[0].authorize(credentials): Promise<{ id: string; name: string; role: string } | null>`, `AUTH_VERSION: number`, `vurderSesjon(session: Session | null): { id: string; role: string } | null` (ren funksjon — gir `null` for en sesjon uten `user.id`/`user.role`, ellers de to feltene), `krevInnloggetSesjon(): Promise<{ id: string; role: string } | null>` (henter sesjonen via `getServerSession(authOptions)` og kaller `vurderSesjon`). Alle autentiserte endepunkter — nå og i senere faser — skal kalle `krevInnloggetSesjon()`, ikke `getServerSession` direkte.

**Bakgrunn (claudex-runden, runde 1+2, F03):** NextAuth sin JWT-strategi kaller ikke `authorize` på nytt for en allerede utstedt sesjonscookie — den dekodes og fornyes bare med `NEXTAUTH_SECRET`. Å bytte ut `authorize` alene etterlater derfor alle som allerede er innlogget med den gamle delte admin-kontoen (`{ id: "1", name: "Admin" }`) fortsatt innlogget, uten en reell `AdminUser`-tilknytning. I runde 1 ble kun den beskyttede layouten rettet; runde 2 fant at `POST /api/boliger`, `PUT`/`DELETE /api/boliger/[id]` og `POST /api/upload` fortsatt sjekket bare `if (!session)`, som en gammel delt sesjon fortsatt tilfredsstiller. Løsningen er én delt guard (`krevInnloggetSesjon`) brukt på alle fire stedene, pluss sesjons-stempling (`AUTH_VERSION`) så en gammel sesjon aldri får `user.id` i utgangspunktet.

- [ ] **Step 1: Skriv feilende tester**

```ts
// lib/auth.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { hashPassword } from "./password";
import { buildAuthorize, authOptions, AUTH_VERSION, vurderSesjon } from "./auth";

describe("authorize", () => {
  it("returns the user with id and role on correct credentials", async () => {
    const prisma = await createTestDb();
    await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: await hashPassword("riktig-passord"), navn: "Magnus" },
    });
    const authorize = buildAuthorize(prisma);
    const result = await authorize({ username: "magnus", password: "riktig-passord" });
    expect(result).toMatchObject({ name: "Magnus", role: "eier" });
    expect(result?.id).toBeDefined();
  });

  it("rejects a wrong password", async () => {
    const prisma = await createTestDb();
    await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: await hashPassword("riktig-passord"), navn: "Magnus" },
    });
    const authorize = buildAuthorize(prisma);
    await expect(authorize({ username: "magnus", password: "feil" })).resolves.toBeNull();
  });

  it("rejects the old shared env-var credentials even if still set", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "gammelt-passord";
    const prisma = await createTestDb();
    const authorize = buildAuthorize(prisma);
    await expect(authorize({ username: "admin", password: "gammelt-passord" })).resolves.toBeNull();
  });
});

describe("legacy session invalidation (F03)", () => {
  it("jwt callback does not stamp authVersion onto a pre-existing token with no fresh sign-in", async () => {
    const eksisterendeToken = { sub: "1", name: "Admin", email: "admin@lineiendom.no", id: "1" };
    const resultat = await authOptions.callbacks!.jwt!({ token: eksisterendeToken } as any);
    expect(resultat.authVersion).toBeUndefined();
    expect(resultat.id).toBeUndefined();
  });

  it("jwt callback stamps authVersion and copies id/role on a fresh sign-in", async () => {
    const resultat = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: "7", name: "Magnus", role: "eier" },
    } as any);
    expect(resultat).toMatchObject({ id: "7", role: "eier", authVersion: AUTH_VERSION });
  });

  it("session callback drops session.user for a token without the current authVersion", async () => {
    const gammelToken = { sub: "1", id: "1" };
    const sesjon = await authOptions.callbacks!.session!({
      session: { user: { name: "Admin" }, expires: "" },
      token: gammelToken,
    } as any);
    expect(sesjon.user).toBeUndefined();
  });

  it("session callback keeps id/role for a token stamped by the new authorize flow", async () => {
    const ferskToken = { id: "7", role: "eier", authVersion: AUTH_VERSION };
    const sesjon = await authOptions.callbacks!.session!({
      session: { user: {}, expires: "" },
      token: ferskToken,
    } as any);
    expect(sesjon.user).toMatchObject({ id: "7", role: "eier" });
  });
});

describe("vurderSesjon", () => {
  it("gir null for en null-sesjon", () => {
    expect(vurderSesjon(null)).toBeNull();
  });

  it("gir null for en sesjon uten user.id (gammel delt sesjon)", () => {
    expect(vurderSesjon({ user: { name: "Admin" }, expires: "" } as any)).toBeNull();
  });

  it("gir id og role for en gyldig sesjon", () => {
    expect(vurderSesjon({ user: { id: "7", role: "eier" }, expires: "" } as any)).toEqual({ id: "7", role: "eier" });
  });
});
```

- [ ] **Step 2: Kjør testene, bekreft at de feiler**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL with "buildAuthorize is not exported".

- [ ] **Step 3: Implementer `buildAuthorize(prisma: PrismaClient)` i `lib/auth.ts`**

Slår opp `AdminUser` på `brukernavn`, kaller `verifyPassword` mot `passord`-hashen, returnerer `{ id: String(bruker.id), name: bruker.navn, role: bruker.rolle }` ved treff, `null` ellers. Fjern all bruk av `process.env.ADMIN_USERNAME`/`ADMIN_PASSWORD` fullstendig — ingen fallback. I `CredentialsProvider({ ..., authorize: buildAuthorize(prisma) })` importeres `prisma` fra `@/lib/prisma` (singleton-klienten), ikke en ny instans.

- [ ] **Step 4: Implementer legacy-sesjon-ugyldiggjøring og `vurderSesjon`/`krevInnloggetSesjon` (F03, F10)**

Eksporter `export const AUTH_VERSION = 2;` fra `lib/auth.ts`. I `authOptions.callbacks.jwt({ token, user })`: hvis `user` er satt (fersk innlogging), sett `token.id = user.id`, `token.role = user.role`, `token.authVersion = AUTH_VERSION`. Hvis ikke, og `token.authVersion !== AUTH_VERSION`, fjern `token.id`/`token.role`/`token.authVersion` fra tokenet (`delete`). I `authOptions.callbacks.session({ session, token })`: bygg et nytt objekt i stedet for å mutere et potensielt udefinert `session.user` — `session.user = token.authVersion === AUTH_VERSION && token.id && token.role ? { ...session.user, id: token.id, role: token.role } : undefined;`. Implementer `vurderSesjon(session)` som en ren funksjon: `session?.user?.id && session?.user?.role ? { id: session.user.id, role: session.user.role } : null`. Implementer `krevInnloggetSesjon()` som `vurderSesjon(await getServerSession(authOptions))`.

- [ ] **Step 5: Oppdater guard i `app/admin/(protected)/layout.tsx`**

Bytt `if (!session)` til `if (!session?.user?.id)`. Der `brukerNavn` sendes videre til `AdminNavbar` (Task 5), bruk `session.user?.name ?? "Ukjent bruker"` — `name` er fortsatt valgfri i NextAuth sin opprinnelige `DefaultSession["user"]`-type selv etter augmenteringen i Step 6, så en fallback er nødvendig for en påkrevd `string`-prop.

- [ ] **Step 6: Erstatt `getServerSession`-kallene i de tre API-rutene med `krevInnloggetSesjon`**

I `app/api/boliger/route.ts` (POST), `app/api/boliger/[id]/route.ts` (PUT og DELETE) og `app/api/upload/route.ts` (POST): bytt `const session = await getServerSession(authOptions); if (!session) ...` med `const bruker = await krevInnloggetSesjon(); if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });`. Fjern nå ubrukte `getServerSession`/`authOptions`-importer i disse filene der de ikke lenger brukes direkte.

- [ ] **Step 7: Legg til NextAuth-type-augmentering**

```ts
// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    authVersion?: number;
  }
}
```

- [ ] **Step 8: Skriv feilende route-nivå-tester for den delte guarden (F03)**

(`prismaMock` bygges via `vi.hoisted` — Vitest hoister `vi.mock`-kall til toppen av filen før andre `const`-er initialiseres, så en vanlig `const prismaMock = ...` ville gitt en `ReferenceError` når `vi.mock`-fabrikken refererer til den; se F16 i runde 3.)

```ts
// app/api/boliger/route.test.ts
import { describe, it, expect, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { bolig: { create: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

import { POST } from "./route";

describe("POST /api/boliger", () => {
  it("avviser en gammel delt admin-sesjon uten bruker-id", async () => {
    const req = new Request("http://localhost/api/boliger", {
      method: "POST",
      body: JSON.stringify({ tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" }),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(401);
    expect(prismaMock.bolig.create).not.toHaveBeenCalled();
  });
});
```

```ts
// app/api/upload/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

import { POST } from "./route";

describe("POST /api/upload", () => {
  it("avviser en gammel delt admin-sesjon uten bruker-id", async () => {
    const res = await POST(new Request("http://localhost/api/upload", { method: "POST" }) as any);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 9: Kjør testene, bekreft at de feiler, så implementer Step 6 fullt ut og kjør på nytt**

Run: `npx vitest run lib/auth.test.ts app/api/boliger/route.test.ts app/api/upload/route.test.ts`
Expected: PASS (10 + 1 + 1 tester) når Step 6 er riktig gjennomført på alle tre filene.

- [ ] **Step 10: Typecheck**

Run: `npx tsc --noEmit`
Expected: ingen feil.

- [ ] **Step 11: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts types/next-auth.d.ts app/admin app/api/boliger app/api/upload
git commit -m "feat: authenticate against AdminUser, invalidate legacy sessions, and guard every protected route with one shared check"
```

---

## Task 4: Seed-script for de fire eierkontoene

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts` (legg til `migrations.seed: "tsx prisma/seed.ts"`)
- Test: `prisma/seed.test.ts`

**Bakgrunn (F09):** Prosjektet har en `prisma.config.ts`, og når den finnes leser Prisma 7 seed-kommandoen fra `migrations.seed` i den filen — **ikke** fra `package.json`s gamle `"prisma": { "seed": ... }`-felt, som ignoreres når `prisma.config.ts` finnes.

**Interfaces:**
- Consumes: `hashPassword` (Task 1), `AdminUser` (Task 2).
- Produces: `seedAdminUsers(prisma: PrismaClient, users: { brukernavn: string; passord: string; navn: string }[]): Promise<void>` — eksporteres fra `prisma/seed.ts` slik at testen kan kalle den direkte uten å gå via CLI.

- [ ] **Step 1: Skriv feilende test**

```ts
// prisma/seed.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { seedAdminUsers } from "./seed";
import { verifyPassword } from "../lib/password";

describe("seedAdminUsers", () => {
  it("creates a user whose stored password is hashed, not plaintext", async () => {
    const prisma = await createTestDb();
    await seedAdminUsers(prisma, [{ brukernavn: "oskar", passord: "test123", navn: "Oskar" }]);
    const bruker = await prisma.adminUser.findUniqueOrThrow({ where: { brukernavn: "oskar" } });
    expect(bruker.passord).not.toBe("test123");
    await expect(verifyPassword("test123", bruker.passord)).resolves.toBe(true);
  });

  it("is idempotent — running it twice does not create duplicates", async () => {
    const prisma = await createTestDb();
    const users = [{ brukernavn: "oskar", passord: "test123", navn: "Oskar" }];
    await seedAdminUsers(prisma, users);
    await seedAdminUsers(prisma, users);
    const count = await prisma.adminUser.count({ where: { brukernavn: "oskar" } });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Kjør testene, bekreft at de feiler**

Run: `npx vitest run prisma/seed.test.ts`
Expected: FAIL with "Cannot find module './seed'".

- [ ] **Step 3: Implementer `seedAdminUsers`** med `prisma.adminUser.upsert` per bruker (`where: { brukernavn }`, hash passordet før lagring). CLI-delen av `prisma/seed.ts` leser de fire kontoenes brukernavn/navn fra en konstant liste i filen og passordene fra miljøvariabler (`SEED_PASSWORD_MAGNUS` osv.) — ikke hardkodet i kildekoden — og kaller `seedAdminUsers(prisma, [...])` når filen køres direkte (`if (require.main === module)`-mønster eller `import.meta.url`-sjekk).

- [ ] **Step 4: Kjør testene, bekreft at de passerer**

Run: `npx vitest run prisma/seed.test.ts`
Expected: PASS (2 tester).

- [ ] **Step 5: Registrer seed-kommandoen i `prisma.config.ts`**

```ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

- [ ] **Step 6: Kjør seed-scriptet mot den faktiske utviklings-/produksjonsdatabasen**

Sett `SEED_PASSWORD_MAGNUS`/`SEED_PASSWORD_OYSTEIN`/`SEED_PASSWORD_OSKAR`/`SEED_PASSWORD_SIMEN` (fire reelle passord, ikke committet) i miljøet, deretter:

Run: `npx prisma db seed`
Expected: fire `AdminUser`-rader opprettet. Bekreft: `npx prisma studio` eller en direkte query viser de fire brukernavnene med `rolle: "eier"`. Dette må kjøres **før** Task 5, som forutsetter at kontoene finnes.

- [ ] **Step 7: Commit**

```bash
git add prisma/seed.ts prisma/seed.test.ts prisma.config.ts
git commit -m "feat: add idempotent seed script for the four owner accounts"
```

---

## Task 5: Innloggingsskjema og navbar viser innlogget bruker

**Files:**
- Modify: `app/admin/innlogging/page.tsx` (fjern "admin"-placeholder-teksten, generisk tekst)
- Modify: `app/admin/(protected)/AdminNavbar.tsx` (vis `session.user.name` i stedet for fast "Yappuccino Admin")
- Modify: `app/admin/(protected)/layout.tsx` (hent `session.user.name` og send som prop til `AdminNavbar`)

**Interfaces:**
- Consumes: `session.user.name`/`session.user.role` fra Task 3.
- Produces: `AdminNavbar({ brukerNavn }: { brukerNavn: string })`.

- [ ] **Step 1: Oppdater `layout.tsx`** til å sende `brukerNavn={session.user?.name ?? "Ukjent bruker"}` til `<AdminNavbar />` (Task 3 satte allerede denne fallbacken i guard-steget — dette gjenbruker samme verdi, ikke `session.user.name` direkte, siden `name` fortsatt er valgfri i NextAuth sin type selv etter augmenteringen).

- [ ] **Step 2: Oppdater `AdminNavbar.tsx`** til å ta imot `brukerNavn` som prop og vise den (f.eks. ved siden av "Logg ut"-knappen) i stedet for hardkodet "Yappuccino Admin" i header-lenken — behold "Yappuccino Admin" som produktnavn i lenken, legg til brukernavnet separat.

- [ ] **Step 3: Oppdater `InnloggingSkjema.tsx`/`page.tsx`-placeholder** fra `"admin"` til f.eks. `"ditt brukernavn"`.

- [ ] **Step 4: Manuell verifikasjon**

Start dev-server (`./start-dev.sh` eller `npm run dev`), logg inn med en av de seedede kontoene, bekreft at navnet vises i navbaren og at innlogging med de gamle `ADMIN_USERNAME`/`ADMIN_PASSWORD`-verdiene (hvis fortsatt i `.env`) feiler.

- [ ] **Step 5: Fjern `ADMIN_USERNAME`/`ADMIN_PASSWORD` fra `.env` og `.env.production`**, legg til `SEED_PASSWORD_MAGNUS` osv. i stedet (verdier settes manuelt, ikke committes).

- [ ] **Step 6: Commit**

```bash
git add app/admin
git commit -m "feat: show logged-in owner name in admin navbar"
```

---

## Task 6: Eiendom-status på `Bolig`

**Files:**
- Modify: `prisma/schema.prisma` (Bolig: legg til `status`, `kjopesum`, `kjopsdato`, `finansiering`, `estimertVerdiNa`, `estimertVerdiEtterOppussing`)
- Create: `lib/eiendom-status.ts`
- Create: `prisma/backfill-sql.ts`
- Test: `lib/eiendom-status.test.ts`, `prisma/backfill-sql.test.ts`

**Interfaces:**
- Produces: `type EiendomStatus = "vurderes" | "kjopt" | "planlegging" | "under_oppussing" | "klar_for_utleie" | "utleid" | "til_salgs" | "solgt"`, `ALLE_STATUSER: EiendomStatus[]`, `erGyldigStatus(status: unknown): status is EiendomStatus`, `OFFENTLIG_SYNLIGE_STATUSER: EiendomStatus[]`, `erOffentligSynlig(status: string): boolean`, `utledStatusFraAktiv(aktiv: boolean, type: string): EiendomStatus`, `STATUSER_FOR_TYPE: Record<"salg" | "leie", EiendomStatus[]>`, `erStatusGyldigForType(status: string, type: string): boolean`, `STATUS_LABELS: Record<EiendomStatus, string>` (norske labels: "Vurderes", "Kjøpt", "Planlegging", "Under oppussing", "Klar for utleie", "Utleid", "Til salgs", "Solgt") i `lib/eiendom-status.ts` — én kilde til status-labels, brukt av Task 7s statusdropdown og alle status-badges (admin-boligliste, admin-dashboard), i stedet for at samme liste skrives tre ganger.
- Produces: `BOLIG_STATUS_BACKFILL_SQL: string` i `prisma/backfill-sql.ts` — en rå SQL-setning som speiler `utledStatusFraAktiv`, limt inn i migreringsfilen fra Step 7 (ikke et separat, gjenkjørbart script).

**Bakgrunn (F06, F07):** Status og type (`salg`/`leie`) må ikke kunne komme i utakt (en `salg`-bolig satt til `klar_for_utleie`), så `STATUSER_FOR_TYPE` definerer hvilke statuser som er gyldige per type. Og en separat, når-som-helst-gjenkjørbar backfill-script ville kunne overskrive en eier sin manuelle statusendring (f.eks. `under_oppussing`) hvis den ved et uhell køres på nytt. Derfor limes backfillen inn i selve migreringen (Step 7) — Prisma tracker migreringer i `_prisma_migrations` og kjører hver migrering nøyaktig én gang, aldri på nytt.

- [ ] **Step 1: Skriv feilende test for status-helperne**

```ts
// lib/eiendom-status.test.ts
import { describe, it, expect } from "vitest";
import { erOffentligSynlig, erGyldigStatus, utledStatusFraAktiv, erStatusGyldigForType, ALLE_STATUSER, STATUS_LABELS } from "./eiendom-status";

describe("erOffentligSynlig", () => {
  it.each([
    ["til_salgs", true],
    ["klar_for_utleie", true],
    ["vurderes", false],
    ["kjopt", false],
    ["planlegging", false],
    ["under_oppussing", false],
    ["utleid", false],
    ["solgt", false],
  ])("status %s gir synlighet %s", (status, forventet) => {
    expect(erOffentligSynlig(status)).toBe(forventet);
  });

  it("behandler ukjent/tom status som ikke synlig (fail-safe)", () => {
    expect(erOffentligSynlig("")).toBe(false);
    expect(erOffentligSynlig("noe-ukjent")).toBe(false);
  });
});

describe("erGyldigStatus", () => {
  it.each(["vurderes", "kjopt", "planlegging", "under_oppussing", "klar_for_utleie", "utleid", "til_salgs", "solgt"])(
    "%s er gyldig",
    (status) => {
      expect(erGyldigStatus(status)).toBe(true);
    }
  );

  it.each(["", "noe-ukjent", null, undefined, 123])("%s er ugyldig", (status) => {
    expect(erGyldigStatus(status)).toBe(false);
  });
});

describe("utledStatusFraAktiv", () => {
  it.each([
    [true, "salg", "til_salgs"],
    [true, "leie", "klar_for_utleie"],
    [false, "salg", "solgt"],
    [false, "leie", "utleid"],
  ])("aktiv=%s type=%s gir status %s", (aktiv, type, forventet) => {
    expect(utledStatusFraAktiv(aktiv, type)).toBe(forventet);
  });
});

describe("erStatusGyldigForType", () => {
  it.each([
    ["til_salgs", "salg", true],
    ["klar_for_utleie", "salg", false],
    ["klar_for_utleie", "leie", true],
    ["til_salgs", "leie", false],
    ["under_oppussing", "salg", true],
    ["under_oppussing", "leie", true],
  ])("status %s for type %s gir %s", (status, type, forventet) => {
    expect(erStatusGyldigForType(status, type)).toBe(forventet);
  });
});

describe("STATUS_LABELS", () => {
  it("har en norsk label for hver av de 8 statusene", () => {
    for (const status of ALLE_STATUSER) {
      expect(typeof STATUS_LABELS[status]).toBe("string");
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Kjør testen, bekreft at den feiler**

Run: `npx vitest run lib/eiendom-status.test.ts`
Expected: FAIL with "Cannot find module './eiendom-status'".

- [ ] **Step 3: Implementer `lib/eiendom-status.ts`**

Typen, `ALLE_STATUSER` (alle 8 verdiene), `erGyldigStatus` (typeguard: `typeof status === "string" && (ALLE_STATUSER as string[]).includes(status)`), `OFFENTLIG_SYNLIGE_STATUSER` (kun `"til_salgs"` og `"klar_for_utleie"`), `erOffentligSynlig` (whitelist-sjekk, default `false` for alt annet inkl. ukjent verdi), `utledStatusFraAktiv` (ren funksjon, mapping-tabellen fra testen over), `STATUSER_FOR_TYPE` (`salg`: `["vurderes","kjopt","planlegging","under_oppussing","til_salgs","solgt"]`, `leie`: `["vurderes","kjopt","planlegging","under_oppussing","klar_for_utleie","utleid"]`), `erStatusGyldigForType` (slår opp i `STATUSER_FOR_TYPE[type]`, `false` for ukjent type) og `STATUS_LABELS` (et `Record<EiendomStatus, string>` med de norske labelene listet i Interfaces).

- [ ] **Step 4: Kjør testen, bekreft at den passerer**

Run: `npx vitest run lib/eiendom-status.test.ts`
Expected: PASS (25 tester).

- [ ] **Step 5: Legg til feltene i `prisma/schema.prisma`**

```prisma
model Bolig {
  // ...eksisterende felt...
  status                      String    @default("til_salgs")
  kjopesum                     Int?
  kjopsdato                    DateTime?
  finansiering                 String?
  estimertVerdiNa              Int?
  estimertVerdiEtterOppussing  Int?
}
```

- [ ] **Step 6: Opprett `prisma/backfill-sql.ts`**

```ts
// prisma/backfill-sql.ts
export const BOLIG_STATUS_BACKFILL_SQL = `
UPDATE "Bolig" SET status = CASE
  WHEN aktiv = 1 AND type = 'leie' THEN 'klar_for_utleie'
  WHEN aktiv = 1 THEN 'til_salgs'
  WHEN type = 'leie' THEN 'utleid'
  ELSE 'solgt'
END;
`.trim();
```

(Denne CASE-logikken speiler `utledStatusFraAktiv` nøyaktig — Step 9 tester at de stemmer overens.)

- [ ] **Step 7: Generer migrering uten å kjøre den, lim inn backfill-SQL, kjør den**

Run: `npx prisma migrate dev --name bolig_eiendom_status --create-only`

Åpne den genererte `prisma/migrations/<timestamp>_bolig_eiendom_status/migration.sql`, og legg til innholdet av `BOLIG_STATUS_BACKFILL_SQL` (kopiert nøyaktig, inkludert linjeskift) som en egen SQL-setning etter `ALTER TABLE`-setningene som legger til de nye kolonnene.

Run: `npx prisma migrate dev && npx prisma generate`
Expected: migreringen (med backfill) kjører mot utviklingsdatabasen, `app/generated/prisma` regenerert.

- [ ] **Step 8: Skriv feilende konsistens-test**

```ts
// prisma/backfill-sql.test.ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb } from "../tests/helpers/testDb";
import { BOLIG_STATUS_BACKFILL_SQL } from "./backfill-sql";
import { utledStatusFraAktiv } from "../lib/eiendom-status";

describe("BOLIG_STATUS_BACKFILL_SQL", () => {
  it("er limt inn ordrett i migreringsfilen (ingen drift mellom SQL og TS)", () => {
    const migrasjonsmappe = readdirSync(join(__dirname, "migrations")).find((navn) =>
      navn.endsWith("_bolig_eiendom_status")
    );
    expect(migrasjonsmappe).toBeDefined();
    const sql = readFileSync(join(__dirname, "migrations", migrasjonsmappe!, "migration.sql"), "utf-8");
    expect(sql).toContain(BOLIG_STATUS_BACKFILL_SQL);
  });

  it("gir samme resultat som utledStatusFraAktiv for alle aktiv/type-kombinasjoner", async () => {
    const prisma = await createTestDb();
    const rader = await Promise.all([
      prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", aktiv: true } }),
      prisma.bolig.create({ data: { tittel: "B", adresse: "B", by: "Ålesund", type: "leie", beskrivelse: "", aktiv: true } }),
      prisma.bolig.create({ data: { tittel: "C", adresse: "C", by: "Ålesund", type: "salg", beskrivelse: "", aktiv: false } }),
      prisma.bolig.create({ data: { tittel: "D", adresse: "D", by: "Ålesund", type: "leie", beskrivelse: "", aktiv: false } }),
    ]);

    await prisma.$executeRawUnsafe(BOLIG_STATUS_BACKFILL_SQL);

    for (const rad of rader) {
      const oppdatert = await prisma.bolig.findUniqueOrThrow({ where: { id: rad.id } });
      expect(oppdatert.status).toBe(utledStatusFraAktiv(rad.aktiv, rad.type));
    }
  });
});
```

- [ ] **Step 9: Kjør testen, bekreft at den feiler**

Run: `npx vitest run prisma/backfill-sql.test.ts`
Expected: FAIL (modul `./backfill-sql` finnes ikke før Step 6 — hvis Step 6/7 allerede er gjort, feiler i stedet den første `it` dersom innlimingen i migreringsfilen ikke er ordrett lik; juster til de er identiske).

- [ ] **Step 10: Kjør testen på nytt, bekreft at den passerer**

Run: `npx vitest run prisma/backfill-sql.test.ts`
Expected: PASS (2 tester).

- [ ] **Step 11: Koordinert utrulling — fryseperiode + før/etter-kontroll (F07, runde 2)**

Migrerings-tracking løser at *scriptet* ikke kan kjøres på nytt, men løser ikke at den gamle appen (som fortsatt bare skriver `aktiv`) kan gjøre en endring i vinduet mellom migrering og at Task 7s nye lesekode er live. Siden dette er et internt 4-brukersystem (ikke et system med rullende flerinstans-utrulling), er den riktige, proporsjonale løsningen en kort fryseperiode, ikke automatisert koordinering mellom instanser:

1. Si til de fire eierne at ingen skal redigere boliger (status/aktiv) de neste få minuttene.
2. Noter hvilke `Bolig`-IDer som i dag er offentlig synlige (`aktiv = true`).
3. Kjør migreringen fra Step 7 (backfill) og deploy Task 7s nye lesekode i samme vindu, uten noen admin-skriving mellom dem.
4. Bekreft at nøyaktig samme sett av IDer er synlige via `status IN ('til_salgs','klar_for_utleie')`.
5. Si at fryseperioden er over.

Dette er et driftssteg, ikke en automatisert test — loggfør resultatet i commit-meldingen eller i deploy-notater.

- [ ] **Step 12: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/eiendom-status.ts lib/eiendom-status.test.ts prisma/backfill-sql.ts prisma/backfill-sql.test.ts app/generated
git commit -m "feat: add eiendom status lifecycle to Bolig with a migration-tracked backfill from aktiv"
```

---

## Task 7: Offentlige queries og admin-skjema bruker status

**Files:**
- Create: `lib/eiendom.ts`
- Test: `lib/eiendom.test.ts`
- Test: `lib/eiendom-status.test.ts` (utvides med valideringstester, se Step 6)
- Test: `app/api/boliger/[id]/route.test.ts` (samtidighetsbeskyttelse, se Step 10)
- Modify: `lib/eiendom-status.ts` (nye funksjoner `validerStatusForSkriving`, `resolverEffektivStatus`, `statusLabel`)
- Modify: `app/(public)/page.tsx`
- Modify: `app/(public)/boliger/page.tsx`
- Modify: `app/(public)/salg/page.tsx`
- Modify: `app/(public)/leie/page.tsx`
- Modify: `app/(public)/salg/[id]/page.tsx`
- Modify: `app/(public)/leie/[id]/page.tsx`
- Modify: `app/api/boliger/route.ts` (GET bruker felles query+projeksjon; POST validerer status)
- Modify: `app/api/boliger/[id]/route.ts` (GET bruker felles projeksjon+synlighetssjekk; PUT validerer status)
- Modify: `components/admin/BoligSkjema.tsx` (bytt `aktiv`-checkbox til `status`-dropdown, filtrert på valgt type)
- Modify: `app/admin/(protected)/boliger/[id]/page.tsx` (send `status` i stedet for `aktiv`)
- Modify: `app/admin/(protected)/boliger/page.tsx` (status-badge i stedet for aktiv/inaktiv-badge)
- Modify: `app/admin/(protected)/page.tsx` ("Aktive"-stat byttes til et offentlig-synlig-tall basert på status)

**Bakgrunn (claudex-runden, runde 1+2, F01/F02/F05/F06):** `aktiv` leses i dag på syv andre steder enn de to jeg opprinnelig dekket (`/salg`, `/leie`, begge detaljsidene, og `GET /api/boliger`), og `GET /api/boliger/[id]` returnerer hele Prisma-raden uautentisert — inkludert de nye interne feltene (`kjopesum`, `kjopsdato`, `finansiering`, estimerte verdier) så snart de er utfylt. Dette rettes med én felles datatilgangsfunksjon med en explisitt feltprojeksjon, brukt av *alle* lesesteder. Runde 2 fant at min første skrive-validering kun kjørte når `data.status` faktisk var med i forespørselen — en opprettelse av en `leie`-bolig uten status fikk likevel det type-ufornuftige kolonne-defaultet `til_salgs`, og en oppdatering som bare endret `type` (eller bare `status`) hoppet over valideringen fullstendig siden det andre feltet var `undefined`. Løsningen er `resolverEffektivStatus`, som regner ut det *faktiske* status/type-paret som vil bli lagret (slår sammen med eksisterende rad ved oppdatering, og gir et type-kompatibelt default ved opprettelse) — og det er *det* paret som valideres, ikke de rå, delvise feltene fra forespørselen.

**Interfaces:**
- Consumes: `OFFENTLIG_SYNLIGE_STATUSER`, `erGyldigStatus`, `erStatusGyldigForType`, `STATUSER_FOR_TYPE` fra Task 6.
- Produces i `lib/eiendom.ts`: `OFFENTLIG_BOLIG_FELTER` (Prisma `select`-objekt — inkluderer `id, tittel, adresse, by, pris, type, storrelse, rom, bad, beskrivelse, bilder, lat, lng, status, opprettet`; utelater `kjopesum, kjopsdato, finansiering, estimertVerdiNa, estimertVerdiEtterOppussing, aktiv, oppdatert`), `type OffentligBolig`, `hentOffentligSynligeBoliger(prisma: PrismaClient, opts?: { type?: string; by?: string; take?: number }): Promise<OffentligBolig[]>`, `hentOffentligSynligBolig(prisma: PrismaClient, id: number, type?: string): Promise<OffentligBolig | null>`.
- Produces i `lib/eiendom-status.ts`: `validerStatusForSkriving(status: unknown, type: string): string | null` — returnerer en norsk feilmelding hvis status mangler/er ugyldig/ikke matcher typen, `null` hvis gyldig. `resolverEffektivStatus(input: { status?: unknown; type?: string }, eksisterende?: { status: string; type: string }): { status: unknown; type: string }` — regner ut hva som faktisk vil bli lagret (type-kompatibelt default ved opprettelse uten status; sammenslått med eksisterende rad ved en delvis oppdatering), *før* `validerStatusForSkriving` kalles på resultatet. Kaster en feil hvis verken `input.type` eller `eksisterende.type` er satt, slik at returtypens `type: string` faktisk er sann (TypeScript kan ikke vite det av `input.type ?? eksisterende?.type` alene, siden begge er valgfrie — se F18 i Task 7s bakgrunn). Begge API-rutene bruker denne kombinasjonen, ikke `validerStatusForSkriving` alene (se F06 i bakgrunnen). `statusLabel(status: string): string` — trygg label-oppslag som ikke krever at kallstedet har narrowet `status` til `EiendomStatus` (se F18).

- [ ] **Step 1: Skriv feilende test som låser datatilgang-kontrakten**

```ts
// lib/eiendom.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { hentOffentligSynligeBoliger, hentOffentligSynligBolig } from "./eiendom";

describe("hentOffentligSynligeBoliger", () => {
  it("returnerer kun boliger med offentlig synlig status", async () => {
    const prisma = await createTestDb();
    await prisma.bolig.create({ data: { tittel: "Til salgs", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs" } });
    await prisma.bolig.create({ data: { tittel: "Under oppussing", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "", status: "under_oppussing" } });

    const synlige = await hentOffentligSynligeBoliger(prisma);

    expect(synlige.map((b) => b.tittel)).toEqual(["Til salgs"]);
  });

  it("filtrerer på type og by, og respekterer take", async () => {
    const prisma = await createTestDb();
    await prisma.bolig.create({ data: { tittel: "Salg Ålesund", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs" } });
    await prisma.bolig.create({ data: { tittel: "Leie Ålesund", adresse: "B", by: "Ålesund", type: "leie", beskrivelse: "", status: "klar_for_utleie" } });
    await prisma.bolig.create({ data: { tittel: "Salg Molde", adresse: "C", by: "Molde", type: "salg", beskrivelse: "", status: "til_salgs" } });

    // Sammenligner som usorterte mengder — flere rader kan få identisk opprettet-tidsstempel
    // i rask rekkefølge, så eksakt rekkefølge fra orderBy er ikke noe testen skal låse.
    const etterType = (await hentOffentligSynligeBoliger(prisma, { type: "salg" })).map((b) => b.tittel).sort();
    expect(etterType).toEqual(["Salg Molde", "Salg Ålesund"].sort());

    const etterBy = (await hentOffentligSynligeBoliger(prisma, { by: "Ålesund" })).map((b) => b.tittel).sort();
    expect(etterBy).toEqual(["Leie Ålesund", "Salg Ålesund"].sort());

    expect(await hentOffentligSynligeBoliger(prisma, { take: 1 })).toHaveLength(1);
  });

  it("eksponerer ikke interne felt som kjopesum eller finansiering", async () => {
    const prisma = await createTestDb();
    await prisma.bolig.create({ data: { tittel: "Til salgs", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs", kjopesum: 4000000, finansiering: "Lån i banken" } });

    const [bolig] = await hentOffentligSynligeBoliger(prisma);

    expect(bolig).not.toHaveProperty("kjopesum");
    expect(bolig).not.toHaveProperty("finansiering");
  });
});

describe("hentOffentligSynligBolig", () => {
  it("returnerer null for en bolig som ikke er offentlig synlig", async () => {
    const prisma = await createTestDb();
    const bolig = await prisma.bolig.create({ data: { tittel: "Under oppussing", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "under_oppussing" } });

    expect(await hentOffentligSynligBolig(prisma, bolig.id)).toBeNull();
  });

  it("returnerer null når type ikke matcher", async () => {
    const prisma = await createTestDb();
    const bolig = await prisma.bolig.create({ data: { tittel: "Til salgs", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs" } });

    expect(await hentOffentligSynligBolig(prisma, bolig.id, "leie")).toBeNull();
  });

  it("returnerer boligen uten interne felt når den er synlig og type matcher", async () => {
    const prisma = await createTestDb();
    const bolig = await prisma.bolig.create({ data: { tittel: "Til salgs", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs", kjopesum: 4000000 } });

    const resultat = await hentOffentligSynligBolig(prisma, bolig.id, "salg");

    expect(resultat?.tittel).toBe("Til salgs");
    expect(resultat).not.toHaveProperty("kjopesum");
  });
});
```

- [ ] **Step 2: Kjør testen, bekreft at den feiler**

Run: `npx vitest run lib/eiendom.test.ts`
Expected: FAIL with "Cannot find module './eiendom'".

- [ ] **Step 3: Implementer `lib/eiendom.ts`**

`OFFENTLIG_BOLIG_FELTER` som et `select`-objekt med feltene listet i Interfaces. `hentOffentligSynligeBoliger`: `prisma.bolig.findMany({ where: { status: { in: OFFENTLIG_SYNLIGE_STATUSER }, ...(opts?.type ? { type: opts.type } : {}), ...(opts?.by ? { by: { contains: opts.by } } : {}) }, select: OFFENTLIG_BOLIG_FELTER, orderBy: { opprettet: "desc" }, take: opts?.take })`. `hentOffentligSynligBolig`: `prisma.bolig.findFirst({ where: { id, status: { in: OFFENTLIG_SYNLIGE_STATUSER }, ...(type ? { type } : {}) }, select: OFFENTLIG_BOLIG_FELTER })`.

- [ ] **Step 4: Kjør testen, bekreft at den passerer**

Run: `npx vitest run lib/eiendom.test.ts`
Expected: PASS (6 tester).

- [ ] **Step 5: Oppdater alle offentlige lesesteder**

- `app/(public)/page.tsx`, `app/(public)/boliger/page.tsx`: `hentOffentligSynligeBoliger(prisma)` (forsiden med `{ take: 6 }`).
- `app/(public)/salg/page.tsx`: `hentOffentligSynligeBoliger(prisma, { type: "salg" })`.
- `app/(public)/leie/page.tsx`: `hentOffentligSynligeBoliger(prisma, { type: "leie" })`.
- `app/(public)/salg/[id]/page.tsx`: `hentOffentligSynligBolig(prisma, parseInt(id), "salg")`, `notFound()` hvis `null` (fjern den manuelle `bolig.type !== "salg"`-sjekken, den er nå dekket av helperen).
- `app/(public)/leie/[id]/page.tsx`: samme med `"leie"`.
- `app/api/boliger/route.ts` GET: `hentOffentligSynligeBoliger(prisma, { type: searchParams.get("type") ?? undefined, by: searchParams.get("by") ?? undefined })`.
- `app/api/boliger/[id]/route.ts` GET: `hentOffentligSynligBolig(prisma, parseInt(id))`, 404 hvis `null` (samme respons som i dag, men nå også når boligen finnes men ikke er offentlig synlig).

- [ ] **Step 6: Skriv feilende test for skrive-validering**

Legg til i `lib/eiendom-status.test.ts`s importlinje (den som i dag har `erOffentligSynlig, erGyldigStatus, utledStatusFraAktiv, erStatusGyldigForType`): legg til `validerStatusForSkriving, resolverEffektivStatus`. Deretter, nye `describe`-blokker i samme fil:

```ts
describe("validerStatusForSkriving", () => {
  it("godtar en gyldig status for riktig type", () => {
    expect(validerStatusForSkriving("til_salgs", "salg")).toBeNull();
  });

  it("avviser tom status", () => {
    expect(validerStatusForSkriving("", "salg")).toMatch(/status/i);
  });

  it("avviser ukjent status", () => {
    expect(validerStatusForSkriving("ferdig", "salg")).toMatch(/status/i);
  });

  it("avviser en status som ikke passer typen", () => {
    expect(validerStatusForSkriving("klar_for_utleie", "salg")).toMatch(/type/i);
  });
});

describe("resolverEffektivStatus", () => {
  it("gir et type-kompatibelt default ved opprettelse uten status", () => {
    expect(resolverEffektivStatus({ type: "leie" })).toEqual({ status: "klar_for_utleie", type: "leie" });
    expect(resolverEffektivStatus({ type: "salg" })).toEqual({ status: "til_salgs", type: "salg" });
  });

  it("beholder eksisterende status ved en oppdatering som bare endrer type", () => {
    expect(resolverEffektivStatus({ type: "leie" }, { status: "til_salgs", type: "salg" })).toEqual({ status: "til_salgs", type: "leie" });
  });

  it("beholder eksisterende type ved en oppdatering som bare endrer status", () => {
    expect(resolverEffektivStatus({ status: "under_oppussing" }, { status: "til_salgs", type: "salg" })).toEqual({ status: "under_oppussing", type: "salg" });
  });
});
```

(Testen for "beholder eksisterende status ved en oppdatering som bare endrer type" gir et par som `validerStatusForSkriving` vil avvise — det er riktig: en eier som bare endrer type må også sende en status som passer den nye typen, i stedet for at systemet stille godtar en ugyldig kombinasjon.)

- [ ] **Step 7: Kjør testen, bekreft at den feiler**

Run: `npx vitest run lib/eiendom-status.test.ts`
Expected: FAIL with "validerStatusForSkriving is not exported".

- [ ] **Step 8: Implementer `validerStatusForSkriving` og `resolverEffektivStatus`** i `lib/eiendom-status.ts`. `validerStatusForSkriving`: `if (!erGyldigStatus(status)) return "Ugyldig eller manglende status."`, deretter `if (!erStatusGyldigForType(status, type)) return \`Status "${status}" er ikke gyldig for type "${type}".\``, ellers `null`. `resolverEffektivStatus(input, eksisterende)`: `const type = input.type ?? eksisterende?.type; if (!type) throw new Error("Mangler type for statusvalidering.");` (etter denne guarden er `type` narrowet til `string`), deretter `const status = input.status ?? eksisterende?.status ?? (type === "leie" ? "klar_for_utleie" : "til_salgs")`, returner `{ status, type }`.

- [ ] **Step 9: Kjør testen, bekreft at den passerer**

Run: `npx vitest run lib/eiendom-status.test.ts`
Expected: PASS (32 tester).

**Bakgrunn (claudex-runden, runde 3, F17):** Å alltid skrive det resolverte `status`/`type`-paret tilbake i en `update` er en lost-update-felle: hvis forespørsel A bare redigerer `tittel` mens den fortsatt har den gamle statusen i hånden, og forespørsel B i mellomtiden endrer status, overskriver As skriving stille Bs endring. Fiksen er en betinget (optimistisk) oppdatering som bare lykkes hvis raden fortsatt har den statusen/typen A faktisk leste.

- [ ] **Step 10: Skriv feilende test for samtidighetsbeskyttelsen**

```ts
// app/api/boliger/[id]/route.test.ts
import { describe, it, expect, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    bolig: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "1", role: "eier" }, expires: "" }) }));

import { PUT } from "./route";

describe("PUT /api/boliger/[id]", () => {
  it("gir 409 hvis status ble endret av en annen mellom lesing og skriving", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 0 });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "solgt" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(409);
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "til_salgs", type: "salg" } })
    );
    expect(prismaMock.bolig.update).not.toHaveBeenCalled();
  });

  it("oppdaterer status betinget når ingen samtidig endring har skjedd", async () => {
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "solgt", type: "salg" });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "solgt" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(200);
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "til_salgs", type: "salg" } })
    );
  });

  it("bruker vanlig update (ikke updateMany) for en ren tittel-redigering uten status/type", async () => {
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.update.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg", tittel: "Oppdatert tittel" });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ tittel: "Oppdatert tittel" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(200);
    expect(prismaMock.bolig.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { tittel: "Oppdatert tittel" } });
    expect(prismaMock.bolig.updateMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 11: Kjør testen, bekreft at den feiler**

Run: `npx vitest run app/api/boliger/\[id\]/route.test.ts`
Expected: FAIL (dagens `PUT` kaller `prisma.bolig.update` direkte, ikke `findUnique`/`updateMany`, så mock-forventningene stemmer ikke).

- [ ] **Step 12: Implementer resolveren, valideringen og den betingede oppdateringen i begge API-rutene**

I `app/api/boliger/route.ts` POST: etter `const data = await req.json()`, kall `const { status, type } = resolverEffektivStatus(data);`, deretter `validerStatusForSkriving(status, type)` — returner 400 med feilmeldingen hvis den ikke er `null`, ellers sett `data.status = status; data.type = type;` før `prisma.bolig.create({ data })`. (Ingen samtidighets-problem her — det finnes ingen eksisterende rad å komme i konflikt med.)

I `app/api/boliger/[id]/route.ts` PUT: hent `const eksisterende = await prisma.bolig.findUnique({ where: { id } });`, 404 hvis `null`. Hvis `data.status !== undefined || data.type !== undefined`: regn ut `const { status, type } = resolverEffektivStatus(data, eksisterende);`, valider som i POST, sett `data.status = status; data.type = type;`, og skriv med `const resultat = await prisma.bolig.updateMany({ where: { id, status: eksisterende.status, type: eksisterende.type }, data });` — hvis `resultat.count === 0`, returner `NextResponse.json({ error: "Eiendommen ble endret av en annen i mellomtiden. Last siden på nytt og prøv igjen." }, { status: 409 })`; ellers hent raden på nytt med `findUnique` og returner den. Hvis verken `status` eller `type` er med i forespørselen: ingen samtidighetsrisiko for disse feltene — bruk vanlig `prisma.bolig.update({ where: { id }, data })` direkte.

- [ ] **Step 13: Kjør testen, bekreft at den passerer**

Run: `npx vitest run app/api/boliger/\[id\]/route.test.ts`
Expected: PASS (3 tester).

- [ ] **Step 14: Oppdater `BoligSkjema.tsx`**

Bytt `aktiv: boolean` i `BoligData` med `status: string`. Legg til en `<select>` for status hvor `<option>`-listen kommer fra `STATUSER_FOR_TYPE[form.type as "salg" | "leie"]`, med labels fra `statusLabel` (se Step 15 — importert fra `lib/eiendom-status.ts`). Når `type` endres og nåværende `status` ikke er i den nye listen, sett `status` til `STATUSER_FOR_TYPE[nyType][0]`. Behold `aktiv`-kolonnen i databasen urørt (brukes ikke lenger av UI eller queries, fjernes ikke i denne planen).

- [ ] **Step 15: Legg til `statusLabel`-helper (F18)**

`bolig.status` er typet som vanlig `string` av Prisma (ikke den strammere `EiendomStatus`-unionen), så direkte indeksering av `STATUS_LABELS[bolig.status]` feiler strict typecheck. Legg til i `lib/eiendom-status.ts`: `export function statusLabel(status: string): string { return erGyldigStatus(status) ? STATUS_LABELS[status] : status; }`. Bruk `statusLabel(...)` i stedet for direkte `STATUS_LABELS[...]`-indeksering alle steder (Step 14, og badge-stedene i Step 16/17).

- [ ] **Step 16: Oppdater `[id]/page.tsx`** til å sende `status: bolig.status` i `initial`-objektet i stedet for `aktiv: bolig.aktiv`.

- [ ] **Step 17: Oppdater boligliste i admin (`boliger/page.tsx`)** til å vise en status-badge (`statusLabel(bolig.status)`) i stedet for aktiv/inaktiv-badgen.

- [ ] **Step 18: Oppdater admin-dashboard (`app/admin/(protected)/page.tsx`)** — bytt `prisma.bolig.count({ where: { aktiv: true } })`/"Aktive"-stat-tilen til `prisma.bolig.count({ where: { status: { in: OFFENTLIG_SYNLIGE_STATUSER } } })`, relabel til "Synlig offentlig". Bytt **også** aktiv/inaktiv-badgen i "Siste boliger"-listen (samme fil, loopen over `sisteeBoliger`) til samme `statusLabel(bolig.status)`-badge som i Step 17 (F01, runde 2 — denne listen er lett å overse fordi den ligger i en annen loop enn hovedtabellen i `boliger/page.tsx`).

- [ ] **Step 19: Manuell verifikasjon**

Start dev-server. Åpne `/admin/boliger/[id]`, bekreft status-dropdown viser riktig forhåndsvalgt verdi og kun viser statuser som passer boligens type. Lagre en endring, bekreft den slår gjennom på `/boliger`, `/salg` eller `/leie`, og at `GET /api/boliger/<id>` for en bolig med status `under_oppussing` gir 404. Bekreft at et `PUT`-kall med `{"status":""}` gir 400, og at et `PUT`-kall som bare sender `{"type":"leie"}` på en `til_salgs`-bolig også gir 400.

- [ ] **Step 20: Commit**

```bash
git add lib/eiendom.ts lib/eiendom.test.ts lib/eiendom-status.ts lib/eiendom-status.test.ts "app/(public)" app/api/boliger components/admin/BoligSkjema.tsx "app/admin/(protected)"
git commit -m "feat: drive public visibility, API responses and admin forms from eiendom status, with optimistic concurrency on writes"
```

---

## Task 8: Delprosjekt-modell og grunnleggende admin-UI

**Files:**
- Modify: `prisma/schema.prisma` (ny modell `Delprosjekt`, back-relation `delprosjekter Delprosjekt[]` på `Bolig`)
- Create: `app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx`
- Create: `app/admin/(protected)/boliger/[id]/delprosjekter/NyttDelprosjektSkjema.tsx`
- Create: `app/admin/(protected)/boliger/[id]/delprosjekter/actions.ts`
- Create: `lib/delprosjekt.ts`
- Test: `lib/delprosjekt.test.ts`
- Modify: `app/api/boliger/[id]/route.ts` (DELETE: avvis med 409 hvis eiendommen har delprosjekter)
- Modify: `components/admin/BoligSkjema.tsx` (`handleSlett` viser feilmeldingen fra en 409-respons)

**Bakgrunn (claudex-runden, F04, F11):** Den beskyttede layouten (Task 3) sjekker bare innlogging for *sideoppføring* — en Server Action nås direkte og må autentisere seg selv, ifølge den installerte Next.js-sikkerhetsguiden (`node_modules/next/dist/docs/01-app/02-guides/data-security.md`). I tillegg vil `Delprosjekt.eiendomId` være en påkrevd fremmednøkkel, så et usjekket `DELETE` på en eiendom med delprosjekter vil feile med en databasefeil i stedet for en forklarlig respons.

**Interfaces:**
- Consumes: `Bolig` (Task 6), `createTestDb()` (Task 1).
- Produces: `Delprosjekt { id, eiendomId, navn, beskrivelse, budsjett, status, opprettet, oppdatert }`, `opprettDelprosjekt(prisma: PrismaClient, input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }): Promise<Delprosjekt>`, `harDelprosjekter(prisma: PrismaClient, eiendomId: number): Promise<boolean>` i `lib/delprosjekt.ts` — eiendomId/delprosjektId-par brukes av alle senere faser (timer, utgifter, dokumenter) som fremmednøkkel.
- Produces: `opprettDelprosjektAction(input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }): Promise<Delprosjekt>` i `actions.ts` — en `"use server"`-funksjon som selv sjekker autentisering før den kaller `opprettDelprosjekt`.

- [ ] **Step 1: Skriv feilende test for modellen og opprett-funksjonen**

```ts
// lib/delprosjekt.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { opprettDelprosjekt, harDelprosjekter } from "./delprosjekt";

describe("opprettDelprosjekt", () => {
  it("knytter delprosjektet til riktig eiendom med status planlagt som default", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "Karl Johns Veg", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    const delprosjekt = await opprettDelprosjekt(prisma, { eiendomId: eiendom.id, navn: "Kjøkken", budsjett: 147500 });

    expect(delprosjekt.eiendomId).toBe(eiendom.id);
    expect(delprosjekt.navn).toBe("Kjøkken");
    expect(delprosjekt.status).toBe("planlagt");
  });

  it("tillater samme delprosjektnavn på to forskjellige eiendommer", async () => {
    const prisma = await createTestDb();
    const a = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const b = await prisma.bolig.create({ data: { tittel: "B", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "" } });

    await opprettDelprosjekt(prisma, { eiendomId: a.id, navn: "Kjøkken" });
    await opprettDelprosjekt(prisma, { eiendomId: b.id, navn: "Kjøkken" });

    const antall = await prisma.delprosjekt.count({ where: { navn: "Kjøkken" } });
    expect(antall).toBe(2);
  });
});

describe("harDelprosjekter", () => {
  it("er true når eiendommen har minst ett delprosjekt", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await opprettDelprosjekt(prisma, { eiendomId: eiendom.id, navn: "Kjøkken" });

    expect(await harDelprosjekter(prisma, eiendom.id)).toBe(true);
  });

  it("er false når eiendommen ikke har noen delprosjekter", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    expect(await harDelprosjekter(prisma, eiendom.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Kjør testen, bekreft at den feiler**

Run: `npx vitest run lib/delprosjekt.test.ts`
Expected: FAIL (Prisma: `prisma.delprosjekt` finnes ikke / modul finnes ikke).

- [ ] **Step 3: Legg til modellen i `prisma/schema.prisma`**

```prisma
model Delprosjekt {
  id          Int      @id @default(autoincrement())
  eiendomId   Int
  eiendom     Bolig    @relation(fields: [eiendomId], references: [id])
  navn        String
  beskrivelse String?
  budsjett    Int?
  status      String   @default("planlagt")
  opprettet   DateTime @default(now())
  oppdatert   DateTime @updatedAt
}
```

Legg til `delprosjekter Delprosjekt[]` som nytt felt på `Bolig`-modellen.

- [ ] **Step 4: Generer migrering og regenerer klienten**

Run: `npx prisma migrate dev --name delprosjekt && npx prisma generate`

- [ ] **Step 5: Implementer `lib/delprosjekt.ts`** — `opprettDelprosjekt` er et tynt wrapper om `prisma.delprosjekt.create`; `harDelprosjekter` er `(await prisma.delprosjekt.count({ where: { eiendomId } })) > 0`.

- [ ] **Step 6: Kjør testene, bekreft at de passerer**

Run: `npx vitest run lib/delprosjekt.test.ts`
Expected: PASS (4 tester).

- [ ] **Step 7: Skriv feilende test for autentisering i server-actionen**

```ts
// app/admin/(protected)/boliger/[id]/delprosjekter/actions.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { opprettDelprosjektAction } from "./actions";

describe("opprettDelprosjektAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(opprettDelprosjektAction({ eiendomId: 1, navn: "Kjøkken" })).rejects.toThrow(/ikke autorisert/i);
  });
});
```

- [ ] **Step 8: Kjør testen, bekreft at den feiler**

Run: `npx vitest run app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.test.ts`
Expected: FAIL with "Cannot find module './actions'".

- [ ] **Step 9: Implementer `actions.ts`**

```ts
// app/admin/(protected)/boliger/[id]/delprosjekter/actions.ts
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opprettDelprosjekt } from "@/lib/delprosjekt";

export async function opprettDelprosjektAction(input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");
  if (!input.navn.trim()) throw new Error("Navn er påkrevd.");
  if (input.budsjett !== undefined && input.budsjett < 0) throw new Error("Budsjett kan ikke være negativt.");
  return opprettDelprosjekt(prisma, input);
}
```

- [ ] **Step 10: Kjør testen, bekreft at den passerer**

Run: `npx vitest run app/admin/\(protected\)/boliger/\[id\]/delprosjekter/actions.test.ts`
Expected: PASS.

- [ ] **Step 11: Bygg resten av admin-UI**

`app/admin/(protected)/boliger/[id]/delprosjekter/page.tsx`: server component som henter `eiendom.delprosjekter` og viser dem i en liste (navn, budsjett, status), med `NyttDelprosjektSkjema` (client component, kaller `opprettDelprosjektAction`). Legg en lenke "Delprosjekter" på eiendommens redigeringsside (`boliger/[id]/page.tsx`).

- [ ] **Step 12: Håndter slette-konflikt, inkludert kappløpet mellom sjekk og sletting (F11, runde 2 / F15)**

En sjekk-så-slett (`harDelprosjekter` etterfulgt av `prisma.bolig.delete`) har et kappløp: et delprosjekt kan opprettes mellom de to kallene, og selve `delete`-kallet vil da feile med en fremmednøkkel-feil i stedet for en kontrollert respons. Derfor fanges feilen fra selve slettingen også, ikke bare forhåndssjekken:

I `app/api/boliger/[id]/route.ts` sin `DELETE`: etter autentiseringssjekken, kall `harDelprosjekter(prisma, parseInt(id))` og returner 409 (som før) hvis `true` — dette er den vanlige, raske veien. Pakk deretter selve `prisma.bolig.delete(...)`-kallet i `try/catch`; i `catch`, hvis feilen er en Prisma fremmednøkkel-feil (SQLite: `error.code === "P2003"`), returner samme `NextResponse.json({ error: "Kan ikke slette en eiendom med registrerte delprosjekter." }, { status: 409 })` i stedet for å la feilen bli en ukontrollert 500.

I `BoligSkjema.tsx`s `handleSlett`: hvis responsen ikke er `ok`, parse JSON-kroppen i et eget `try/catch` (en 500 fra et annet lag er ikke garantert å ha en JSON-kropp) — `let feilmelding = "Noe gikk galt. Prøv igjen."; try { const data = await res.json(); feilmelding = data.error ?? feilmelding; } catch {}`, deretter `setFeil(feilmelding)` i stedet for å gjøre ingenting; vis `feil`-meldingen i skjemaet (samme mønster som i `handleSubmit`).

- [ ] **Step 13: Manuell verifikasjon**

Start dev-server, åpne en eiendoms redigeringsside, naviger til "Delprosjekter", opprett "Kjøkken" med budsjett 147500, bekreft det vises i listen. Prøv deretter å slette den samme eiendommen fra `boliger/[id]/page.tsx` og bekreft at feilmeldingen om registrerte delprosjekter vises i stedet for en krasjende forespørsel.

- [ ] **Step 14: Full typecheck av hele planen (F10)**

Run: `npx tsc --noEmit`
Expected: ingen feil — dette er sluttsjekken for hele Fundament-planen, etter at alle åtte oppgavene er implementert.

- [ ] **Step 15: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/delprosjekt.ts lib/delprosjekt.test.ts "app/admin/(protected)/boliger" app/api/boliger components/admin/BoligSkjema.tsx app/generated
git commit -m "feat: add Delprosjekt model and basic management UI"
```
