import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { oppdaterInnstilling } from "./innstilling";
import { beregnArbeidstimerAndeler, beregnFortjenestefordeling } from "./fortjeneste";

async function opprettEiendom(
  prisma: Awaited<ReturnType<typeof createTestDb>>,
  data: { kjopesum?: number | null; salgssum?: number | null } = {}
) {
  return prisma.bolig.create({
    data: {
      tittel: "A",
      adresse: "A",
      by: "Ålesund",
      type: "salg",
      beskrivelse: "",
      kjopesum: data.kjopesum,
      salgssum: data.salgssum,
    },
  });
}

describe("beregnArbeidstimerAndeler", () => {
  it("beregner timeandel i prosent basert på registrerte timer", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eier1 = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const eier2 = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });

    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eier1.id, dato: new Date(), antallTimer: 40 } });
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eier2.id, dato: new Date(), antallTimer: 60 } });

    const andeler = await beregnArbeidstimerAndeler(prisma, eiendom.id);
    const magnus = andeler.find((a) => a.brukerId === eier1.id);
    const oystein = andeler.find((a) => a.brukerId === eier2.id);

    expect(andeler).toHaveLength(2);
    expect(magnus?.timer).toBe(40);
    expect(magnus?.andelProsent).toBeCloseTo(40);
    expect(oystein?.timer).toBe(60);
    expect(oystein?.andelProsent).toBeCloseTo(60);
  });

  it("inkluderer eiere uten egne timer med 0 timer og 0 %", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eier1 = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const eier2 = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });

    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eier1.id, dato: new Date(), antallTimer: 10 } });

    const andeler = await beregnArbeidstimerAndeler(prisma, eiendom.id);

    expect(andeler).toHaveLength(2);
    const oystein = andeler.find((a) => a.brukerId === eier2.id);
    expect(oystein?.timer).toBe(0);
    expect(oystein?.andelProsent).toBe(0);
  });

  it("returnerer 0 % til alle eiere når ingen timer er registrert for eiendommen", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const andeler = await beregnArbeidstimerAndeler(prisma, eiendom.id);

    expect(andeler).toHaveLength(1);
    expect(andeler[0].timer).toBe(0);
    expect(andeler[0].andelProsent).toBe(0);
  });
});

describe("beregnFortjenestefordeling", () => {
  it("returnerer beregnet:false når salgssum ikke er satt", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: null });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);

    expect(resultat.beregnet).toBe(false);
    if (!resultat.beregnet) {
      expect(resultat.grunn.length).toBeGreaterThan(0);
    }
  });

  it("returnerer beregnet:false når kjøpesum ikke er satt", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma, { kjopesum: null, salgssum: 1_500_000 });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);

    expect(resultat.beregnet).toBe(false);
    if (!resultat.beregnet) {
      expect(resultat.grunn.length).toBeGreaterThan(0);
    }
  });

  it("returnerer beregnet:false når eiendommen ikke finnes", async () => {
    const prisma = await createTestDb();

    const resultat = await beregnFortjenestefordeling(prisma, 999999);

    expect(resultat.beregnet).toBe(false);
    if (!resultat.beregnet) {
      expect(resultat.grunn.length).toBeGreaterThan(0);
    }
  });

  it("hand-computed happy path: kjopesum 1_000_000, salgssum 1_500_000, utgifter 100_000, kapital 75/25, timer 40/60, Innstilling 10/10", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: 1_500_000 });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eierA = await prisma.adminUser.create({ data: { brukernavn: "a", passord: "x", navn: "A", rolle: "eier" } });
    const eierB = await prisma.adminUser.create({ data: { brukernavn: "b", passord: "x", navn: "B", rolle: "eier" } });

    // Kapital: A 75 %, B 25 %
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierA.id, dato: new Date(), belop: 7500 } });
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierB.id, dato: new Date(), belop: 2500 } });

    // Timer: A 40 %, B 60 %
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierA.id, dato: new Date(), antallTimer: 40 } });
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierB.id, dato: new Date(), antallTimer: 60 } });

    // Utgifter: totalt 100_000 (inkl. en rad uten delprosjekt)
    await prisma.utgift.create({ data: { eiendomId: eiendom.id, delprosjektId: delprosjekt.id, dato: new Date(), kategori: "A", belop: 60_000 } });
    await prisma.utgift.create({ data: { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 40_000 } });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);

    expect(resultat.beregnet).toBe(true);
    if (!resultat.beregnet) throw new Error("forventet beregnet:true");

    expect(resultat.kjopesum).toBe(1_000_000);
    expect(resultat.salgssum).toBe(1_500_000);
    expect(resultat.totalUtgifter).toBe(100_000);
    expect(resultat.fortjeneste).toBe(400_000);
    expect(resultat.likedelProsent).toBe(80);
    expect(resultat.arbeidstimerAndelProsent).toBe(10);
    expect(resultat.kapitalAndelProsent).toBe(10);
    expect(resultat.arbeidstimerFallbackBrukt).toBe(false);
    expect(resultat.kapitalFallbackBrukt).toBe(false);

    const a = resultat.perEier.find((e) => e.brukerId === eierA.id);
    const b = resultat.perEier.find((e) => e.brukerId === eierB.id);
    expect(a).toBeDefined();
    expect(b).toBeDefined();

    // Hand-computed:
    // fortjeneste = 1_500_000 - 1_000_000 - 100_000 = 400_000
    // likedel A = likedel B = 400_000 * 0.8 / 2 = 160_000
    // arbeidsdel A = 400_000 * 0.1 * 0.4 = 16_000 ; arbeidsdel B = 400_000 * 0.1 * 0.6 = 24_000
    // kapitaldel A = 400_000 * 0.1 * 0.75 = 30_000 ; kapitaldel B = 400_000 * 0.1 * 0.25 = 10_000
    // totalt A = 160_000 + 16_000 + 30_000 = 206_000
    // totalt B = 160_000 + 24_000 + 10_000 = 194_000
    expect(a?.kapitalandelProsent).toBeCloseTo(75);
    expect(a?.arbeidsandelProsent).toBeCloseTo(40);
    expect(a?.likedel).toBeCloseTo(160_000);
    expect(a?.arbeidsdel).toBeCloseTo(16_000);
    expect(a?.kapitaldel).toBeCloseTo(30_000);
    expect(a?.totalt).toBeCloseTo(206_000);

    expect(b?.kapitalandelProsent).toBeCloseTo(25);
    expect(b?.arbeidsandelProsent).toBeCloseTo(60);
    expect(b?.likedel).toBeCloseTo(160_000);
    expect(b?.arbeidsdel).toBeCloseTo(24_000);
    expect(b?.kapitaldel).toBeCloseTo(10_000);
    expect(b?.totalt).toBeCloseTo(194_000);

    const sum = resultat.perEier.reduce((s, e) => s + e.totalt, 0);
    expect(sum).toBeCloseTo(400_000);
  });

  it("negativ fortjeneste: komponentene er negative i samme proporsjoner, uten klipping eller feil", async () => {
    const prisma = await createTestDb();
    // salgssum < kjopesum + totalUtgifter => fortjeneste = 900_000 - 1_000_000 - 100_000 = -200_000
    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: 900_000 });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eierA = await prisma.adminUser.create({ data: { brukernavn: "a", passord: "x", navn: "A", rolle: "eier" } });
    const eierB = await prisma.adminUser.create({ data: { brukernavn: "b", passord: "x", navn: "B", rolle: "eier" } });

    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierA.id, dato: new Date(), belop: 7500 } });
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierB.id, dato: new Date(), belop: 2500 } });

    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierA.id, dato: new Date(), antallTimer: 40 } });
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierB.id, dato: new Date(), antallTimer: 60 } });

    await prisma.utgift.create({ data: { eiendomId: eiendom.id, delprosjektId: delprosjekt.id, dato: new Date(), kategori: "A", belop: 60_000 } });
    await prisma.utgift.create({ data: { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 40_000 } });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);
    if (!resultat.beregnet) throw new Error("forventet beregnet:true");

    expect(resultat.fortjeneste).toBe(-200_000);

    const a = resultat.perEier.find((e) => e.brukerId === eierA.id);
    const b = resultat.perEier.find((e) => e.brukerId === eierB.id);

    // Hand-computed (scaled by -0.5 relative to the happy-path numbers):
    // likedel A = likedel B = -200_000 * 0.8 / 2 = -80_000
    // arbeidsdel A = -200_000 * 0.1 * 0.4 = -8_000 ; arbeidsdel B = -200_000 * 0.1 * 0.6 = -12_000
    // kapitaldel A = -200_000 * 0.1 * 0.75 = -15_000 ; kapitaldel B = -200_000 * 0.1 * 0.25 = -5_000
    // totalt A = -80_000 - 8_000 - 15_000 = -103_000
    // totalt B = -80_000 - 12_000 - 5_000 = -97_000
    expect(a?.likedel).toBeCloseTo(-80_000);
    expect(a?.arbeidsdel).toBeCloseTo(-8_000);
    expect(a?.kapitaldel).toBeCloseTo(-15_000);
    expect(a?.totalt).toBeCloseTo(-103_000);

    expect(b?.likedel).toBeCloseTo(-80_000);
    expect(b?.arbeidsdel).toBeCloseTo(-12_000);
    expect(b?.kapitaldel).toBeCloseTo(-5_000);
    expect(b?.totalt).toBeCloseTo(-97_000);

    const sum = resultat.perEier.reduce((s, e) => s + e.totalt, 0);
    expect(sum).toBeCloseTo(-200_000);
  });

  it("fallback for timer: ingen Timeregistrering-rader gir likt split (100/antallEiere) og arbeidstimerFallbackBrukt:true", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: 1_500_000 });
    const eierA = await prisma.adminUser.create({ data: { brukernavn: "a", passord: "x", navn: "A", rolle: "eier" } });
    const eierB = await prisma.adminUser.create({ data: { brukernavn: "b", passord: "x", navn: "B", rolle: "eier" } });

    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierA.id, dato: new Date(), belop: 7500 } });
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierB.id, dato: new Date(), belop: 2500 } });

    await prisma.utgift.create({ data: { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 100_000 } });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);
    if (!resultat.beregnet) throw new Error("forventet beregnet:true");

    expect(resultat.arbeidstimerFallbackBrukt).toBe(true);
    expect(resultat.kapitalFallbackBrukt).toBe(false);

    const a = resultat.perEier.find((e) => e.brukerId === eierA.id);
    const b = resultat.perEier.find((e) => e.brukerId === eierB.id);
    expect(a?.arbeidsandelProsent).toBeCloseTo(50);
    expect(b?.arbeidsandelProsent).toBeCloseTo(50);

    // Hand-computed:
    // arbeidsdel A = arbeidsdel B = 400_000 * 0.1 * 0.5 = 20_000
    // kapitaldel A = 400_000 * 0.1 * 0.75 = 30_000 ; kapitaldel B = 400_000 * 0.1 * 0.25 = 10_000
    // totalt A = 160_000 + 20_000 + 30_000 = 210_000 ; totalt B = 160_000 + 20_000 + 10_000 = 190_000
    expect(a?.totalt).toBeCloseTo(210_000);
    expect(b?.totalt).toBeCloseTo(190_000);

    const sum = resultat.perEier.reduce((s, e) => s + e.totalt, 0);
    expect(sum).toBeCloseTo(resultat.fortjeneste);
  });

  it("fallback for kapital: ingen Kapitalinnskudd-rader gir likt split (100/antallEiere) og kapitalFallbackBrukt:true", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: 1_500_000 });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eierA = await prisma.adminUser.create({ data: { brukernavn: "a", passord: "x", navn: "A", rolle: "eier" } });
    const eierB = await prisma.adminUser.create({ data: { brukernavn: "b", passord: "x", navn: "B", rolle: "eier" } });

    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierA.id, dato: new Date(), antallTimer: 40 } });
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierB.id, dato: new Date(), antallTimer: 60 } });

    await prisma.utgift.create({ data: { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 100_000 } });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);
    if (!resultat.beregnet) throw new Error("forventet beregnet:true");

    expect(resultat.kapitalFallbackBrukt).toBe(true);
    expect(resultat.arbeidstimerFallbackBrukt).toBe(false);

    const a = resultat.perEier.find((e) => e.brukerId === eierA.id);
    const b = resultat.perEier.find((e) => e.brukerId === eierB.id);
    expect(a?.kapitalandelProsent).toBeCloseTo(50);
    expect(b?.kapitalandelProsent).toBeCloseTo(50);

    // Hand-computed:
    // arbeidsdel A = 400_000 * 0.1 * 0.4 = 16_000 ; arbeidsdel B = 400_000 * 0.1 * 0.6 = 24_000
    // kapitaldel A = kapitaldel B = 400_000 * 0.1 * 0.5 = 20_000
    // totalt A = 160_000 + 16_000 + 20_000 = 196_000 ; totalt B = 160_000 + 24_000 + 20_000 = 204_000
    expect(a?.totalt).toBeCloseTo(196_000);
    expect(b?.totalt).toBeCloseTo(204_000);

    const sum = resultat.perEier.reduce((s, e) => s + e.totalt, 0);
    expect(sum).toBeCloseTo(resultat.fortjeneste);
  });

  it("bruker egendefinert Innstilling (20/5) og gir likedelProsent 75", async () => {
    const prisma = await createTestDb();
    await oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 20, kapitalAndelProsent: 5 });

    const eiendom = await opprettEiendom(prisma, { kjopesum: 1_000_000, salgssum: 1_500_000 });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const eierA = await prisma.adminUser.create({ data: { brukernavn: "a", passord: "x", navn: "A", rolle: "eier" } });
    const eierB = await prisma.adminUser.create({ data: { brukernavn: "b", passord: "x", navn: "B", rolle: "eier" } });

    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierA.id, dato: new Date(), belop: 7500 } });
    await prisma.kapitalinnskudd.create({ data: { eiendomId: eiendom.id, brukerId: eierB.id, dato: new Date(), belop: 2500 } });

    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierA.id, dato: new Date(), antallTimer: 40 } });
    await prisma.timeregistrering.create({ data: { delprosjektId: delprosjekt.id, brukerId: eierB.id, dato: new Date(), antallTimer: 60 } });

    await prisma.utgift.create({ data: { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 100_000 } });

    const resultat = await beregnFortjenestefordeling(prisma, eiendom.id);
    if (!resultat.beregnet) throw new Error("forventet beregnet:true");

    expect(resultat.arbeidstimerAndelProsent).toBe(20);
    expect(resultat.kapitalAndelProsent).toBe(5);
    expect(resultat.likedelProsent).toBe(75);

    const a = resultat.perEier.find((e) => e.brukerId === eierA.id);
    const b = resultat.perEier.find((e) => e.brukerId === eierB.id);

    // Hand-computed:
    // likedel A = likedel B = 400_000 * 0.75 / 2 = 150_000
    // arbeidsdel A = 400_000 * 0.2 * 0.4 = 32_000 ; arbeidsdel B = 400_000 * 0.2 * 0.6 = 48_000
    // kapitaldel A = 400_000 * 0.05 * 0.75 = 15_000 ; kapitaldel B = 400_000 * 0.05 * 0.25 = 5_000
    // totalt A = 150_000 + 32_000 + 15_000 = 197_000 ; totalt B = 150_000 + 48_000 + 5_000 = 203_000
    expect(a?.totalt).toBeCloseTo(197_000);
    expect(b?.totalt).toBeCloseTo(203_000);

    const sum = resultat.perEier.reduce((s, e) => s + e.totalt, 0);
    expect(sum).toBeCloseTo(400_000);
  });
});
