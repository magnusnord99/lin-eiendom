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
