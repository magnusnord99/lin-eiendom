import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  opprettKapitalinnskudd,
  hentInnskuddForEiendom,
  beregnEierandeler,
  harKapitalinnskudd,
  slettKapitalinnskudd,
} from "./kapitalinnskudd";

describe("opprettKapitalinnskudd og hentInnskuddForEiendom", () => {
  it("lagrer et innskudd og henter det tilbake med navn på eieren", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date("2026-10-20T00:00:00.000Z"), belop: 5000, beskrivelse: "Innskudd" });

    const innskudd = await hentInnskuddForEiendom(prisma, eiendom.id);
    expect(innskudd).toHaveLength(1);
    expect(innskudd[0].belop).toBe(5000);
    expect(innskudd[0].brukerNavn).toBe("Magnus");
  });

  it("sorterer nyeste dato først", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date("2026-10-10T00:00:00.000Z"), belop: 1000 });
    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date("2026-10-20T00:00:00.000Z"), belop: 2000 });

    const innskudd = await hentInnskuddForEiendom(prisma, eiendom.id);
    expect(innskudd.map((i) => i.belop)).toEqual([2000, 1000]);
  });
});

describe("beregnEierandeler", () => {
  it("beregner eierandel i prosent basert på innskutt beløp", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier1 = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const eier2 = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });

    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier1.id, dato: new Date(), belop: 7500 });
    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier2.id, dato: new Date(), belop: 2500 });

    const eierandeler = await beregnEierandeler(prisma, eiendom.id);
    const magnus = eierandeler.find((e) => e.brukerId === eier1.id);
    const oystein = eierandeler.find((e) => e.brukerId === eier2.id);

    expect(magnus?.andelProsent).toBeCloseTo(75);
    expect(oystein?.andelProsent).toBeCloseTo(25);
  });

  it("returnerer 0 % til alle eiere når ingen innskudd er registrert", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const eierandeler = await beregnEierandeler(prisma, eiendom.id);

    expect(eierandeler).toHaveLength(1);
    expect(eierandeler[0].belop).toBe(0);
    expect(eierandeler[0].andelProsent).toBe(0);
  });

  it("inkluderer eiere uten egne innskudd med 0 kr og 0 %", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier1 = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const eier2 = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });

    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier1.id, dato: new Date(), belop: 5000 });

    const eierandeler = await beregnEierandeler(prisma, eiendom.id);

    expect(eierandeler).toHaveLength(2);
    const magnus = eierandeler.find((e) => e.brukerId === eier1.id);
    const oystein = eierandeler.find((e) => e.brukerId === eier2.id);
    expect(magnus?.andelProsent).toBeCloseTo(100);
    expect(oystein?.belop).toBe(0);
    expect(oystein?.andelProsent).toBe(0);
  });

  it("regner ikke med innskudd fra en bruker som ikke er eier", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const ikkeEier = await prisma.adminUser.create({ data: { brukernavn: "annen", passord: "x", navn: "Annen", rolle: "annet" } });

    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date(), belop: 5000 });
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: ikkeEier.id, dato: new Date(), belop: 5000 } });

    const eierandeler = await beregnEierandeler(prisma, eiendom.id);

    expect(eierandeler).toHaveLength(1);
    expect(eierandeler[0].brukerId).toBe(eier.id);
    expect(eierandeler[0].belop).toBe(5000);
    expect(eierandeler[0].andelProsent).toBeCloseTo(100);
  });
});

describe("harKapitalinnskudd", () => {
  it("returnerer false når eiendommen ikke har noen innskudd", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    expect(await harKapitalinnskudd(prisma, eiendom.id)).toBe(false);
  });

  it("returnerer true når eiendommen har minst ett innskudd", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date(), belop: 1000 });

    expect(await harKapitalinnskudd(prisma, eiendom.id)).toBe(true);
  });
});

describe("slettKapitalinnskudd", () => {
  it("sletter innskuddet når id finnes", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const innskudd = await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date(), belop: 1000 });

    await slettKapitalinnskudd(prisma, innskudd.id);

    expect(await prisma.kapitalinnskudd.count()).toBe(0);
  });

  it("kaster feil når id ikke finnes", async () => {
    const prisma = await createTestDb();

    await expect(slettKapitalinnskudd(prisma, 999999)).rejects.toThrow();
  });

  it("kaster feil for et ugyldig id i stedet for å slette bredt (undefined eller et objekt)", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date(), belop: 1000 });
    await opprettKapitalinnskudd(prisma, { eiendomId: eiendom.id, brukerId: eier.id, dato: new Date(), belop: 2000 });

    await expect(slettKapitalinnskudd(prisma, undefined as unknown as number)).rejects.toThrow();
    await expect(slettKapitalinnskudd(prisma, { gt: 0 } as unknown as number)).rejects.toThrow();
    expect(await prisma.kapitalinnskudd.count()).toBe(2);
  });
});
