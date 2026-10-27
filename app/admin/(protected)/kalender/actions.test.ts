import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));

// settTilgjengelighetAction and opprettArbeidshendelseAction call revalidatePath, which
// throws outside a real Next.js request scope ("static generation store missing"). No
// sibling actions.test.ts needs this mock because no sibling action calls revalidatePath.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Unlike the fully-mocked prisma used by sibling actions.test.ts files, this file replaces
// @/lib/prisma with a real test database (see tests/helpers/testDb.ts). The brief for this
// file requires confirming end-to-end wiring (round-trip of settTilgjengelighetAction ->
// hentTilgjengelighetForPeriode, the recurrence cap, ownership-error mapping), which a plain
// mock of prisma can't verify honestly.
vi.mock("@/lib/prisma", async () => {
  const { createTestDb } = await import("@/tests/helpers/testDb");
  const prisma = await createTestDb();
  return { prisma };
});

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  settTilgjengelighet,
  hentTilgjengelighetForPeriode,
  TILGJENGELIGHET_EIER_FEIL,
  MAKS_GJENTAKELSER,
} from "@/lib/tilgjengelighet";
import {
  opprettArbeidshendelse,
  hentArbeidshendelserForPeriode,
  ARBEIDSHENDELSE_FEIL,
} from "@/lib/arbeidshendelse";
import {
  settTilgjengelighetAction,
  slettTilgjengelighetAction,
  opprettArbeidshendelseAction,
  slettArbeidshendelseAction,
} from "./actions";

let brukerTeller = 0;
async function opprettBruker() {
  brukerTeller += 1;
  return prisma.adminUser.create({
    data: { brukernavn: `kalender-bruker-${brukerTeller}`, passord: "x", navn: `Bruker ${brukerTeller}`, rolle: "eier" },
  });
}

let boligTeller = 0;
async function opprettBolig() {
  boligTeller += 1;
  return prisma.bolig.create({
    data: { tittel: `Bolig ${boligTeller}`, adresse: "Gate 1", by: "Ålesund", type: "salg", beskrivelse: "" },
  });
}

function medSesjon(brukerId: number) {
  vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: String(brukerId), role: "eier" } } as never);
}

describe("settTilgjengelighetAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(settTilgjengelighetAction({ dato: "2026-11-02", status: "ledig" })).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettTilgjengelighetAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettTilgjengelighetAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("opprettArbeidshendelseAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(opprettArbeidshendelseAction({ eiendomId: 1, tittel: "Befaring", dato: "2026-11-02" })).rejects.toThrow(
      /ikke autorisert/i
    );
  });
});

describe("slettArbeidshendelseAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettArbeidshendelseAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("settTilgjengelighetAction med innlogget sesjon", () => {
  it("lykkes med gyldig input, og raden kan leses tilbake via hentTilgjengelighetForPeriode", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-11-02", status: "ledig" });
    expect(resultat).toEqual({ ok: true, data: null });

    const rader = await hentTilgjengelighetForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );
    const rad = rader.find((r) => r.brukerId === bruker.id);
    expect(rad).toBeDefined();
    expect(rad?.status).toBe("ledig");
  });

  it("oppretter raden under den innloggede brukerens id — input har ingen brukerId-felt å forfalske", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    await settTilgjengelighetAction({ dato: "2026-11-07", status: "ledig" });

    const rad = await prisma.tilgjengelighet.findUnique({
      where: { brukerId_dato: { brukerId: bruker.id, dato: new Date("2026-11-07T00:00:00.000Z") } },
    });
    expect(rad).not.toBeNull();
    expect(rad?.brukerId).toBe(bruker.id);
  });

  it("avviser en dato som ikke finnes etter round-trip (2026-13-01)", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-13-01", status: "ledig" });
    expect(resultat).toEqual({ ok: false, feilmelding: "Ugyldig dato." });
  });

  it("avviser en ugyldig status", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-11-03", status: "opptatt" });
    expect(resultat).toEqual({ ok: false, feilmelding: "Ugyldig status." });
  });

  it.each([
    { fraKl: "09:00", tilKl: undefined },
    { fraKl: undefined, tilKl: "15:00" },
  ])("avviser når bare ett av fraKl/tilKl er satt (bekrefter at validerKlStartSlutt kalles)", async ({ fraKl, tilKl }) => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-11-04", status: "ledig", fraKl, tilKl });
    expect(resultat).toEqual({ ok: false, feilmelding: "Både fra- og til-klokkeslett må fylles ut." });
  });

  it.each([0, 27, 2.5])("avviser gjentaUkerAntall %s med en feilmelding som nevner grensen", async (antall) => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-11-05", status: "ledig", gjentaUkerAntall: antall });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toContain(String(MAKS_GJENTAKELSER));
  });

  it("aksepterer gjentaUkerAntall på grensen (26)", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await settTilgjengelighetAction({ dato: "2026-11-06", status: "ledig", gjentaUkerAntall: 26 });
    expect(resultat).toEqual({ ok: true, data: null });

    const antall = await prisma.tilgjengelighet.count({ where: { brukerId: bruker.id } });
    expect(antall).toBe(26);
  });
});

describe("slettTilgjengelighetAction med innlogget sesjon", () => {
  it("sletter den innloggede brukerens egen rad", async () => {
    const bruker = await opprettBruker();
    const [rad] = await settTilgjengelighet(prisma, {
      brukerId: bruker.id,
      dato: new Date("2026-11-08T00:00:00.000Z"),
      status: "ledig",
    });
    medSesjon(bruker.id);

    const resultat = await slettTilgjengelighetAction(rad.id);
    expect(resultat).toEqual({ ok: true, data: null });
    expect(await prisma.tilgjengelighet.findUnique({ where: { id: rad.id } })).toBeNull();
  });

  it("sletter IKKE en annen brukers rad, og returnerer TILGJENGELIGHET_EIER_FEIL", async () => {
    const eier = await opprettBruker();
    const annen = await opprettBruker();
    const [rad] = await settTilgjengelighet(prisma, {
      brukerId: eier.id,
      dato: new Date("2026-11-09T00:00:00.000Z"),
      status: "ledig",
    });
    medSesjon(annen.id);

    const resultat = await slettTilgjengelighetAction(rad.id);
    expect(resultat).toEqual({ ok: false, feilmelding: TILGJENGELIGHET_EIER_FEIL });
    expect(await prisma.tilgjengelighet.findUnique({ where: { id: rad.id } })).not.toBeNull();
  });
});

describe("opprettArbeidshendelseAction med innlogget sesjon", () => {
  it("lykkes med gyldig input, og hendelsen kan leses tilbake via hentArbeidshendelserForPeriode", async () => {
    const bolig = await opprettBolig();
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await opprettArbeidshendelseAction({ eiendomId: bolig.id, tittel: "Befaring", dato: "2026-11-10" });
    expect(resultat).toEqual({ ok: true, data: null });

    const hendelser = await hentArbeidshendelserForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );
    expect(hendelser.some((h) => h.eiendomId === bolig.id && h.tittel === "Befaring")).toBe(true);
  });

  it("avviser når eiendommen ikke finnes", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await opprettArbeidshendelseAction({ eiendomId: 999999, tittel: "Befaring", dato: "2026-11-11" });
    expect(resultat).toEqual({ ok: false, feilmelding: "Fant ikke eiendommen." });
  });

  it("avviser en tom tittel", async () => {
    const bolig = await opprettBolig();
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await opprettArbeidshendelseAction({ eiendomId: bolig.id, tittel: "   ", dato: "2026-11-12" });
    expect(resultat).toEqual({ ok: false, feilmelding: "Tittel er påkrevd." });
  });

  it("avviser ugyldig fraKl/tilKl-par (bekrefter at validerKlStartSlutt kalles)", async () => {
    const bolig = await opprettBolig();
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await opprettArbeidshendelseAction({
      eiendomId: bolig.id,
      tittel: "Befaring",
      dato: "2026-11-13",
      fraKl: "15:00",
      tilKl: "09:00",
    });
    expect(resultat).toEqual({ ok: false, feilmelding: "Fra-klokkeslett må være før til-klokkeslett." });
  });
});

describe("slettArbeidshendelseAction med innlogget sesjon", () => {
  it("lykkes uavhengig av hvilken bruker som er innlogget (ingen eierskapssjekk)", async () => {
    const bolig = await opprettBolig();
    const opprettetAv = await opprettBruker();
    const annenInnlogget = await opprettBruker();
    const hendelse = await opprettArbeidshendelse(prisma, {
      eiendomId: bolig.id,
      tittel: "Befaring",
      dato: new Date("2026-11-14T00:00:00.000Z"),
      opprettetAvBrukerId: opprettetAv.id,
    });
    medSesjon(annenInnlogget.id);

    const resultat = await slettArbeidshendelseAction(hendelse.id);
    expect(resultat).toEqual({ ok: true, data: null });
    expect(await prisma.arbeidshendelse.findUnique({ where: { id: hendelse.id } })).toBeNull();
  });

  it("returnerer ARBEIDSHENDELSE_FEIL for en ikke-eksisterende id", async () => {
    const bruker = await opprettBruker();
    medSesjon(bruker.id);

    const resultat = await slettArbeidshendelseAction(999999);
    expect(resultat).toEqual({ ok: false, feilmelding: ARBEIDSHENDELSE_FEIL });
  });
});
