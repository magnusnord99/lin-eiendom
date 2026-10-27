// lib/eiendom.test.ts
import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { hentOffentligSynligeBoliger, hentOffentligSynligBolig, plukkSkrivbareBoligFelter, validerBoligPengefelt } from "./eiendom";

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

describe("validerBoligPengefelt", () => {
  it("returnerer null når begge felt er fraværende", () => {
    expect(validerBoligPengefelt({})).toBeNull();
  });

  it("returnerer null når begge felt er null", () => {
    expect(validerBoligPengefelt({ kjopesum: null, salgssum: null })).toBeNull();
  });

  it("returnerer null for et gyldig kjopesum", () => {
    expect(validerBoligPengefelt({ kjopesum: 4_000_000 })).toBeNull();
  });

  it("godtar 4 som et gyldig heltall (kan ikke oppdage parseInt('4e6')-korrupsjon, bare det endelige heltallet)", () => {
    expect(validerBoligPengefelt({ kjopesum: 4 })).toBeNull();
  });

  it("returnerer feilmelding for et ikke-heltall kjopesum", () => {
    expect(validerBoligPengefelt({ kjopesum: 4.5 })).toBe("Ugyldig kjøpesum.");
  });

  it("returnerer feilmelding for et negativt salgssum", () => {
    expect(validerBoligPengefelt({ salgssum: -1 })).toBe("Ugyldig salgssum.");
  });

  it("returnerer feilmelding for et salgssum én over øvre grense", () => {
    expect(validerBoligPengefelt({ salgssum: 2_147_483_648 })).toBe("Ugyldig salgssum.");
  });

  it("godtar et kjopesum nøyaktig på øvre grense", () => {
    expect(validerBoligPengefelt({ kjopesum: 2_147_483_647 })).toBeNull();
  });
});

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
    await prisma.bolig.create({ data: { tittel: "Til salgs", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "til_salgs", kjopesum: 4000000, finansiering: "Lån i banken", salgssum: 4500000 } });

    const [bolig] = await hentOffentligSynligeBoliger(prisma);

    expect(bolig).not.toHaveProperty("kjopesum");
    expect(bolig).not.toHaveProperty("finansiering");
    expect(bolig).not.toHaveProperty("salgssum");
  });
});

describe("hentOffentligSynligBolig", () => {
  it("returnerer null for en bolig som ikke er offentlig synlig", async () => {
    const prisma = await createTestDb();
    const bolig = await prisma.bolig.create({ data: { tittel: "Under oppussing", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "", status: "under_oppussing" } });

    expect(await hentOffentligSynligBolig(prisma, bolig.id)).toBeNull();
  });

  it("returnerer null for en ikke-numerisk id uten å spørre databasen", async () => {
    const prisma = await createTestDb();

    expect(await hentOffentligSynligBolig(prisma, NaN)).toBeNull();
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
