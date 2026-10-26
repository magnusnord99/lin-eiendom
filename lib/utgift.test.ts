import { describe, it, expect, vi } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  opprettUtgift,
  hentUtgifterForEiendom,
  hentKvittering,
  detekterBildeformat,
  lagreKvittering,
  beregnFaktiskPerDelprosjekt,
  slettUtgift,
  harUtgifter,
  UTGIFT_FEIL,
  UTGIFT_KVITTERING_FOR_STOR,
  UTGIFT_KVITTERING_UGYLDIG_FORMAT,
} from "./utgift";

async function opprettEiendom(prisma: Awaited<ReturnType<typeof createTestDb>>) {
  return prisma.bolig.create({
    data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" },
  });
}

describe("opprettUtgift", () => {
  it("lagrer en utgift med alle felt", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });

    const utgift = await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      delprosjektId: delprosjekt.id,
      dato: new Date("2026-10-20T00:00:00.000Z"),
      kategori: "Materialer",
      beskrivelse: "Fliser",
      leverandor: "Byggmax",
      belop: 1500,
      betaltAvBrukerId: bruker.id,
    });

    expect(utgift.eiendomId).toBe(eiendom.id);
    expect(utgift.delprosjektId).toBe(delprosjekt.id);
    expect(utgift.kategori).toBe("Materialer");
    expect(utgift.beskrivelse).toBe("Fliser");
    expect(utgift.leverandor).toBe("Byggmax");
    expect(utgift.belop).toBe(1500);
    expect(utgift.betaltAvBrukerId).toBe(bruker.id);
  });

  it("lagrer en utgift uten valgfrie felt", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);

    const utgift = await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      dato: new Date("2026-10-20T00:00:00.000Z"),
      kategori: "Diverse",
      belop: 500,
    });

    expect(utgift.delprosjektId).toBeNull();
    expect(utgift.betaltAvBrukerId).toBeNull();
    expect(utgift.beskrivelse).toBeNull();
    expect(utgift.leverandor).toBeNull();
    expect(utgift.belop).toBe(500);
  });
});

describe("hentUtgifterForEiendom", () => {
  it("returnerer rader sortert nyeste først, med navn og harKvittering utledet", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus" } });

    await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      delprosjektId: delprosjekt.id,
      dato: new Date("2026-10-10T00:00:00.000Z"),
      kategori: "Materialer",
      belop: 1000,
      betaltAvBrukerId: bruker.id,
    });
    const nyest = await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      dato: new Date("2026-10-20T00:00:00.000Z"),
      kategori: "Diverse",
      belop: 2000,
    });
    await lagreKvittering(prisma, nyest.id, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));

    const findManySpy = vi.spyOn(prisma.utgift, "findMany");

    const utgifter = await hentUtgifterForEiendom(prisma, eiendom.id);

    expect(utgifter.map((u) => u.belop)).toEqual([2000, 1000]);
    expect(utgifter[0].harKvittering).toBe(true);
    expect(utgifter[0].delprosjektId).toBeNull();
    expect(utgifter[0].delprosjektNavn).toBeNull();
    expect(utgifter[0].betaltAvBrukerId).toBeNull();
    expect(utgifter[0].betaltAvNavn).toBeNull();
    expect(utgifter[1].harKvittering).toBe(false);
    expect(utgifter[1].delprosjektNavn).toBe("Kjøkken");
    expect(utgifter[1].betaltAvNavn).toBe("Magnus");

    expect(findManySpy).toHaveBeenCalledTimes(1);
    const kall = findManySpy.mock.calls[0][0] as Record<string, unknown>;
    expect(kall.select).toBeDefined();
    expect(kall.include).toBeUndefined();
    expect(kall.select).not.toHaveProperty("kvitteringBilde");

    findManySpy.mockRestore();
  });
});

describe("hentKvittering", () => {
  it("returnerer bytes og mimeType for en utgift med kvittering", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      dato: new Date(),
      kategori: "Diverse",
      belop: 100,
    });
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
    await lagreKvittering(prisma, utgift.id, bytes);

    const kvittering = await hentKvittering(prisma, utgift.id);

    expect(kvittering).not.toBeNull();
    expect(kvittering?.mimeType).toBe("image/png");
    expect(Buffer.from(kvittering!.bytes).equals(bytes)).toBe(true);
  });

  it("returnerer null for en utgift uten kvittering", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, {
      eiendomId: eiendom.id,
      dato: new Date(),
      kategori: "Diverse",
      belop: 100,
    });

    expect(await hentKvittering(prisma, utgift.id)).toBeNull();
  });

  it("returnerer null for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();

    expect(await hentKvittering(prisma, 999999)).toBeNull();
  });
});

describe("detekterBildeformat", () => {
  it("gjenkjenner JPEG", () => {
    expect(detekterBildeformat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("image/jpeg");
  });

  it("gjenkjenner PNG", () => {
    expect(
      detekterBildeformat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]))
    ).toBe("image/png");
  });

  it("gjenkjenner GIF", () => {
    expect(detekterBildeformat(Buffer.from("GIF89a" + "xxxx", "ascii"))).toBe("image/gif");
    expect(detekterBildeformat(Buffer.from("GIF87a" + "xxxx", "ascii"))).toBe("image/gif");
  });

  it("gjenkjenner WebP", () => {
    expect(detekterBildeformat(Buffer.from("RIFF" + "1234" + "WEBPxxxx", "ascii"))).toBe("image/webp");
  });

  it("returnerer null for et ukjent format", () => {
    expect(detekterBildeformat(Buffer.from("<html><body></body></html>", "ascii"))).toBeNull();
    expect(detekterBildeformat(Buffer.alloc(16))).toBeNull();
  });
});

describe("lagreKvittering", () => {
  it("kaster feil for et bilde over 4 MB, og kaller aldri updateMany", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "Diverse", belop: 100 });
    const updateManySpy = vi.spyOn(prisma.utgift, "updateMany");

    const stortBilde = Buffer.alloc(4_000_001, 0xff);

    await expect(lagreKvittering(prisma, utgift.id, stortBilde)).rejects.toThrow(UTGIFT_KVITTERING_FOR_STOR);
    expect(updateManySpy).not.toHaveBeenCalled();

    updateManySpy.mockRestore();
  });

  it("kaster feil for et ugyldig bildeformat, og kaller aldri updateMany", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "Diverse", belop: 100 });
    const updateManySpy = vi.spyOn(prisma.utgift, "updateMany");

    const ugyldig = Buffer.from("dette er ikke et bilde", "ascii");

    await expect(lagreKvittering(prisma, utgift.id, ugyldig)).rejects.toThrow(UTGIFT_KVITTERING_UGYLDIG_FORMAT);
    expect(updateManySpy).not.toHaveBeenCalled();

    updateManySpy.mockRestore();
  });

  it("kaller updateMany med riktige felt for et gyldig PNG-bilde", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "Diverse", belop: 100 });
    const updateManySpy = vi.spyOn(prisma.utgift, "updateMany");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    await lagreKvittering(prisma, utgift.id, png);

    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: utgift.id },
      data: { kvitteringBilde: png, kvitteringMimeType: "image/png" },
    });

    updateManySpy.mockRestore();
  });

  it("kaster UTGIFT_FEIL når ingen rad matcher (updateMany count 0)", async () => {
    const prisma = await createTestDb();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

    await expect(lagreKvittering(prisma, 999999, png)).rejects.toThrow(UTGIFT_FEIL);
  });
});

describe("beregnFaktiskPerDelprosjekt", () => {
  it("summerer belop per delprosjekt og utelater rader uten delprosjekt", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const delprosjekt1 = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });
    const delprosjekt2 = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Bad" } });

    await opprettUtgift(prisma, { eiendomId: eiendom.id, delprosjektId: delprosjekt1.id, dato: new Date(), kategori: "A", belop: 1000 });
    await opprettUtgift(prisma, { eiendomId: eiendom.id, delprosjektId: delprosjekt1.id, dato: new Date(), kategori: "A", belop: 500 });
    await opprettUtgift(prisma, { eiendomId: eiendom.id, delprosjektId: delprosjekt2.id, dato: new Date(), kategori: "A", belop: 300 });
    await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 9999 });

    const sum = await beregnFaktiskPerDelprosjekt(prisma, eiendom.id);

    expect(sum.get(delprosjekt1.id)).toBe(1500);
    expect(sum.get(delprosjekt2.id)).toBe(300);
    expect(sum.size).toBe(2);
  });
});

describe("slettUtgift", () => {
  it("sletter utgiften når id finnes", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    const utgift = await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 100 });

    await slettUtgift(prisma, utgift.id);

    expect(await prisma.utgift.count()).toBe(0);
  });

  it("kaster feil når id ikke finnes", async () => {
    const prisma = await createTestDb();

    await expect(slettUtgift(prisma, 999999)).rejects.toThrow(UTGIFT_FEIL);
  });

  it("kaster feil for id <= 0 eller ikke-heltall", async () => {
    const prisma = await createTestDb();

    await expect(slettUtgift(prisma, 0)).rejects.toThrow(UTGIFT_FEIL);
    await expect(slettUtgift(prisma, -1)).rejects.toThrow(UTGIFT_FEIL);
    await expect(slettUtgift(prisma, 1.5)).rejects.toThrow(UTGIFT_FEIL);
  });
});

describe("harUtgifter", () => {
  it("returnerer false når eiendommen ikke har noen utgifter", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);

    expect(await harUtgifter(prisma, eiendom.id)).toBe(false);
  });

  it("returnerer true når eiendommen har minst én utgift", async () => {
    const prisma = await createTestDb();
    const eiendom = await opprettEiendom(prisma);
    await opprettUtgift(prisma, { eiendomId: eiendom.id, dato: new Date(), kategori: "A", belop: 100 });

    expect(await harUtgifter(prisma, eiendom.id)).toBe(true);
  });
});
