import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  opprettArbeidshendelse,
  hentArbeidshendelserForPeriode,
  hentKommendeArbeidshendelser,
  slettArbeidshendelse,
  harArbeidshendelser,
  ARBEIDSHENDELSE_FEIL,
} from "./arbeidshendelse";

describe("opprettArbeidshendelse", () => {
  it("lagrer en hendelse og returnerer de lagrede feltene", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const hendelse = await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom.id,
      tittel: "Befaring",
      beskrivelse: "Sjekke tak",
      dato: new Date("2026-11-02T00:00:00.000Z"),
      fraKl: "09:00",
      tilKl: "10:00",
      opprettetAvBrukerId: bruker.id,
    });

    expect(hendelse.eiendomId).toBe(eiendom.id);
    expect(hendelse.tittel).toBe("Befaring");
    expect(hendelse.beskrivelse).toBe("Sjekke tak");
    expect(hendelse.fraKl).toBe("09:00");
    expect(hendelse.tilKl).toBe("10:00");
    expect(hendelse.opprettetAvBrukerId).toBe(bruker.id);
  });

  it("setter beskrivelse/fraKl/tilKl til null når de er utelatt", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const hendelse = await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom.id,
      tittel: "Befaring",
      dato: new Date("2026-11-02T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });

    expect(hendelse.beskrivelse).toBeNull();
    expect(hendelse.fraKl).toBeNull();
    expect(hendelse.tilKl).toBeNull();
  });
});

describe("hentArbeidshendelserForPeriode", () => {
  it("returnerer kun hendelser innenfor perioden, med eiendomstittel", async () => {
    const prisma = await createTestDb();
    const eiendom1 = await prisma.bolig.create({ data: { tittel: "Storgata 1", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eiendom2 = await prisma.bolig.create({ data: { tittel: "Lillegata 2", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom1.id,
      tittel: "Innenfor",
      dato: new Date("2026-11-10T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });
    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom2.id,
      tittel: "Utenfor",
      dato: new Date("2026-12-10T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });

    const hendelser = await hentArbeidshendelserForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );

    expect(hendelser).toHaveLength(1);
    expect(hendelser[0].tittel).toBe("Innenfor");
    expect(hendelser[0].eiendomTittel).toBe("Storgata 1");
  });
});

describe("hentKommendeArbeidshendelser", () => {
  it("returnerer kun hendelser på eller etter fraDato, stigende på dato, med eiendomstittel", async () => {
    const prisma = await createTestDb();
    const eiendom1 = await prisma.bolig.create({ data: { tittel: "Storgata 1", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eiendom2 = await prisma.bolig.create({ data: { tittel: "Lillegata 2", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom1.id,
      tittel: "Før",
      dato: new Date("2026-11-01T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });
    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom2.id,
      tittel: "På dagen",
      dato: new Date("2026-11-10T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });
    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom1.id,
      tittel: "Etter",
      dato: new Date("2026-11-15T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });

    const hendelser = await hentKommendeArbeidshendelser(prisma, new Date("2026-11-10T00:00:00.000Z"), 10);

    expect(hendelser).toHaveLength(2);
    expect(hendelser.map((h) => h.tittel)).toEqual(["På dagen", "Etter"]);
    expect(hendelser[0].eiendomTittel).toBe("Lillegata 2");
    expect(hendelser[0].eiendomId).toBe(eiendom2.id);
    expect(hendelser[1].eiendomTittel).toBe("Storgata 1");
  });

  it("begrenser resultatet til antall, og holder de tidligste", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    for (let dag = 1; dag <= 5; dag++) {
      await opprettArbeidshendelse(prisma, {
        eiendomId: eiendom.id,
        tittel: `Dag ${dag}`,
        dato: new Date(`2026-11-${String(dag).padStart(2, "0")}T00:00:00.000Z`),
        opprettetAvBrukerId: bruker.id,
      });
    }

    const hendelser = await hentKommendeArbeidshendelser(prisma, new Date("2026-11-01T00:00:00.000Z"), 3);

    expect(hendelser).toHaveLength(3);
    expect(hendelser.map((h) => h.tittel)).toEqual(["Dag 1", "Dag 2", "Dag 3"]);
  });
});

describe("slettArbeidshendelse", () => {
  it("sletter en eksisterende hendelse", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const hendelse = await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom.id,
      tittel: "Befaring",
      dato: new Date("2026-11-02T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });

    await slettArbeidshendelse(prisma, hendelse.id);

    const hendelser = await hentArbeidshendelserForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );
    expect(hendelser).toHaveLength(0);
  });

  it("kaster feil for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();

    await expect(slettArbeidshendelse(prisma, 999999)).rejects.toThrow(ARBEIDSHENDELSE_FEIL);
  });
});

describe("harArbeidshendelser", () => {
  it("returnerer false når eiendommen ikke har noen hendelser", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    expect(await harArbeidshendelser(prisma, eiendom.id)).toBe(false);
  });

  it("returnerer true når eiendommen har minst én hendelse", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    await opprettArbeidshendelse(prisma, {
      eiendomId: eiendom.id,
      tittel: "Befaring",
      dato: new Date("2026-11-02T00:00:00.000Z"),
      opprettetAvBrukerId: bruker.id,
    });

    expect(await harArbeidshendelser(prisma, eiendom.id)).toBe(true);
  });
});
