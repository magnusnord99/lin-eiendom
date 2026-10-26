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
