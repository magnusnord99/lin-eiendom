import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { hentInnstilling, oppdaterInnstilling, INNSTILLING_FEIL } from "./innstilling";

describe("hentInnstilling", () => {
  it("oppretter raden med standardverdier {10, 10} på en fersk database", async () => {
    const prisma = await createTestDb();

    const innstilling = await hentInnstilling(prisma);

    expect(innstilling).toEqual({ arbeidstimerAndelProsent: 10, kapitalAndelProsent: 10 });
  });

  it("returnerer samme rad uendret ved andre kall (nullstiller ikke til standardverdier)", async () => {
    const prisma = await createTestDb();

    await oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });
    const forste = await hentInnstilling(prisma);
    const andre = await hentInnstilling(prisma);

    expect(forste).toEqual({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });
    expect(andre).toEqual({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });
  });
});

describe("oppdaterInnstilling", () => {
  it("lagrer gyldige prosentandeler, og en etterfølgende hentInnstilling returnerer dem", async () => {
    const prisma = await createTestDb();

    await oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });

    expect(await hentInnstilling(prisma)).toEqual({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });
  });

  it("kaster feil når summen overstiger 100", async () => {
    const prisma = await createTestDb();

    await expect(
      oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 60, kapitalAndelProsent: 60 })
    ).rejects.toThrow(INNSTILLING_FEIL);

    expect(await hentInnstilling(prisma)).toEqual({ arbeidstimerAndelProsent: 10, kapitalAndelProsent: 10 });
  });

  it("kaster feil for en negativ verdi", async () => {
    const prisma = await createTestDb();

    await expect(
      oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: -1, kapitalAndelProsent: 10 })
    ).rejects.toThrow(INNSTILLING_FEIL);
  });

  it("kaster feil for en verdi over 100", async () => {
    const prisma = await createTestDb();

    await expect(
      oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 101, kapitalAndelProsent: 0 })
    ).rejects.toThrow(INNSTILLING_FEIL);
  });

  it("tillater en sum på nøyaktig 100 (grensetilfellet er gyldig)", async () => {
    const prisma = await createTestDb();

    await oppdaterInnstilling(prisma, { arbeidstimerAndelProsent: 50, kapitalAndelProsent: 50 });

    expect(await hentInnstilling(prisma)).toEqual({ arbeidstimerAndelProsent: 50, kapitalAndelProsent: 50 });
  });

  it("sprer ikke kall-input direkte inn i Prisma-skrivingen (ignorerer ekstra felt som id)", async () => {
    const prisma = await createTestDb();

    const kallMedEkstraFelt = { arbeidstimerAndelProsent: 20, kapitalAndelProsent: 30, id: 2 };
    await oppdaterInnstilling(prisma, kallMedEkstraFelt as never);

    expect(await hentInnstilling(prisma)).toEqual({ arbeidstimerAndelProsent: 20, kapitalAndelProsent: 30 });
    expect(await prisma.innstilling.count()).toBe(1);
    expect(await prisma.innstilling.findUnique({ where: { id: 2 } })).toBeNull();
  });
});
