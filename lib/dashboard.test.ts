import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  manedsgrenserOslo,
  hentTotalInvestert,
  hentTotalUtgifterDenneManeden,
  hentEiendomOversikt,
} from "./dashboard";

describe("manedsgrenserOslo", () => {
  it("returnerer novembers grenser for en dato midt i november (UTC)", () => {
    const resultat = manedsgrenserOslo(new Date("2026-11-15T12:00:00.000Z"));

    expect(resultat).toEqual({
      start: new Date("2026-11-01T00:00:00.000Z"),
      sluttEksklusiv: new Date("2026-12-01T00:00:00.000Z"),
    });
  });

  it("returnerer desembers grenser når det er 21:00 i Oslo 31. desember (fortsatt desember)", () => {
    // 20:00 UTC = 21:00 Oslo (UTC+1 om vinteren) 31. desember.
    const resultat = manedsgrenserOslo(new Date("2026-12-31T20:00:00.000Z"));

    expect(resultat).toEqual({
      start: new Date("2026-12-01T00:00:00.000Z"),
      sluttEksklusiv: new Date("2027-01-01T00:00:00.000Z"),
    });
  });

  it("returnerer januars grenser når det allerede er 00:30 i Oslo 1. januar, selv om det er 31. desember i UTC", () => {
    // 23:30 UTC 31. desember = 00:30 Oslo 1. januar (UTC+1 om vinteren).
    const resultat = manedsgrenserOslo(new Date("2026-12-31T23:30:00.000Z"));

    expect(resultat).toEqual({
      start: new Date("2027-01-01T00:00:00.000Z"),
      sluttEksklusiv: new Date("2027-02-01T00:00:00.000Z"),
    });
  });
});

describe("hentTotalInvestert", () => {
  it("summerer kapitalinnskudd over flere eiendommer", async () => {
    const prisma = await createTestDb();
    const eiendom1 = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const eiendom2 = await prisma.bolig.create({ data: { tittel: "B", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await prisma.kapitalinnskudd.create({
      data: { eiendomId: eiendom1.id, brukerId: bruker.id, dato: new Date("2026-01-01T00:00:00.000Z"), belop: 100_000 },
    });
    await prisma.kapitalinnskudd.create({
      data: { eiendomId: eiendom2.id, brukerId: bruker.id, dato: new Date("2026-02-01T00:00:00.000Z"), belop: 50_000 },
    });

    expect(await hentTotalInvestert(prisma)).toBe(150_000);
  });

  it("returnerer 0 når det ikke finnes kapitalinnskudd", async () => {
    const prisma = await createTestDb();

    expect(await hentTotalInvestert(prisma)).toBe(0);
  });
});

describe("hentTotalUtgifterDenneManeden", () => {
  it("summerer kun utgifter innenfor måneden til den oppgitte datoen", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const naa = new Date("2026-11-15T12:00:00.000Z");

    await prisma.utgift.create({
      data: { eiendomId: eiendom.id, dato: new Date("2026-11-10T00:00:00.000Z"), kategori: "div", belop: 1_000 },
    });
    await prisma.utgift.create({
      data: { eiendomId: eiendom.id, dato: new Date("2026-10-10T00:00:00.000Z"), kategori: "div", belop: 5_000 },
    });

    expect(await hentTotalUtgifterDenneManeden(prisma, naa)).toBe(1_000);
  });

  it("returnerer 0 når ingen utgifter er innenfor måneden", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const naa = new Date("2026-11-15T12:00:00.000Z");

    await prisma.utgift.create({
      data: { eiendomId: eiendom.id, dato: new Date("2026-10-10T00:00:00.000Z"), kategori: "div", belop: 5_000 },
    });

    expect(await hentTotalUtgifterDenneManeden(prisma, naa)).toBe(0);
  });
});

describe("hentEiendomOversikt", () => {
  it("returnerer én rad per eiendom med korrekte utgifts- og budsjettsummer for hver tilstand", async () => {
    const prisma = await createTestDb();

    // (a) delprosjekt med satt budsjett, pluss utgifter.
    const eiendomA = await prisma.bolig.create({ data: { tittel: "A - budsjettert", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await prisma.delprosjekt.create({ data: { eiendomId: eiendomA.id, navn: "Kjøkken", budsjett: 50_000 } });
    await prisma.utgift.create({ data: { eiendomId: eiendomA.id, dato: new Date("2026-11-05T00:00:00.000Z"), kategori: "div", belop: 20_000 } });
    await prisma.utgift.create({ data: { eiendomId: eiendomA.id, dato: new Date("2026-11-06T00:00:00.000Z"), kategori: "div", belop: 5_000 } });

    // (b) delprosjekt med budsjett: null, ingen utgifter.
    const eiendomB = await prisma.bolig.create({ data: { tittel: "B - null budsjett", adresse: "B", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await prisma.delprosjekt.create({ data: { eiendomId: eiendomB.id, navn: "Bad", budsjett: null } });

    // (c) ingen delprosjekter.
    const eiendomC = await prisma.bolig.create({ data: { tittel: "C - uten delprosjekt", adresse: "C", by: "Ålesund", type: "salg", beskrivelse: "" } });

    // (d) delprosjekt med budsjett: 0 (eksplisitt satt til null kroner).
    const eiendomD = await prisma.bolig.create({ data: { tittel: "D - null kroner budsjett", adresse: "D", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await prisma.delprosjekt.create({ data: { eiendomId: eiendomD.id, navn: "Fasade", budsjett: 0 } });

    // (e) to delprosjekter, en budsjettert og en ikke.
    const eiendomE = await prisma.bolig.create({ data: { tittel: "E - delvis budsjettert", adresse: "E", by: "Ålesund", type: "salg", beskrivelse: "" } });
    await prisma.delprosjekt.create({ data: { eiendomId: eiendomE.id, navn: "Tak", budsjett: 30_000 } });
    await prisma.delprosjekt.create({ data: { eiendomId: eiendomE.id, navn: "Vinduer", budsjett: null } });

    const oversikt = await hentEiendomOversikt(prisma);

    expect(oversikt).toHaveLength(5);

    const radA = oversikt.find((r) => r.id === eiendomA.id)!;
    expect(radA.totalUtgift).toBe(25_000);
    expect(radA.totalBudsjett).toBe(50_000);
    expect(radA.antallDelprosjekter).toBe(1);
    expect(radA.antallMedBudsjett).toBe(1);

    const radB = oversikt.find((r) => r.id === eiendomB.id)!;
    expect(radB.totalUtgift).toBe(0);
    expect(radB.totalBudsjett).toBe(0);
    expect(radB.antallDelprosjekter).toBe(1);
    expect(radB.antallMedBudsjett).toBe(0);

    const radC = oversikt.find((r) => r.id === eiendomC.id)!;
    expect(radC.totalUtgift).toBe(0);
    expect(radC.totalBudsjett).toBe(0);
    expect(radC.antallDelprosjekter).toBe(0);
    expect(radC.antallMedBudsjett).toBe(0);

    const radD = oversikt.find((r) => r.id === eiendomD.id)!;
    expect(radD.totalUtgift).toBe(0);
    expect(radD.totalBudsjett).toBe(0);
    expect(radD.antallDelprosjekter).toBe(1);
    expect(radD.antallMedBudsjett).toBe(1);

    const radE = oversikt.find((r) => r.id === eiendomE.id)!;
    expect(radE.totalUtgift).toBe(0);
    expect(radE.totalBudsjett).toBe(30_000);
    expect(radE.antallDelprosjekter).toBe(2);
    expect(radE.antallMedBudsjett).toBe(1);

    // Sortert etter tittel (asc), slik `hentEiendomOversikt` er spesifisert å gjøre.
    expect(oversikt.map((r) => r.tittel)).toEqual([
      "A - budsjettert",
      "B - null budsjett",
      "C - uten delprosjekt",
      "D - null kroner budsjett",
      "E - delvis budsjettert",
    ]);
  });
});
