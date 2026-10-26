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
