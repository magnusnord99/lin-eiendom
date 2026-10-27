import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  erGyldigTilgjengelighetStatus,
  erGyldigKlokkeslett,
  validerKlStartSlutt,
  settTilgjengelighet,
  hentTilgjengelighetForPeriode,
  tellLedigePerDag,
  slettTilgjengelighet,
  TILGJENGELIGHET_EIER_FEIL,
} from "./tilgjengelighet";

describe("erGyldigTilgjengelighetStatus", () => {
  it("returnerer true for gyldige statuser", () => {
    expect(erGyldigTilgjengelighetStatus("ledig")).toBe(true);
    expect(erGyldigTilgjengelighetStatus("ikke_ledig")).toBe(true);
  });

  it("returnerer false for ugyldige verdier", () => {
    expect(erGyldigTilgjengelighetStatus("")).toBe(false);
    expect(erGyldigTilgjengelighetStatus("ukjent")).toBe(false);
    expect(erGyldigTilgjengelighetStatus(null)).toBe(false);
    expect(erGyldigTilgjengelighetStatus(undefined)).toBe(false);
  });
});

describe("erGyldigKlokkeslett", () => {
  it("returnerer true for gyldige klokkeslett", () => {
    expect(erGyldigKlokkeslett("00:00")).toBe(true);
    expect(erGyldigKlokkeslett("23:59")).toBe(true);
    expect(erGyldigKlokkeslett("09:30")).toBe(true);
  });

  it("returnerer false for ugyldige klokkeslett", () => {
    expect(erGyldigKlokkeslett("24:00")).toBe(false);
    expect(erGyldigKlokkeslett("9:30")).toBe(false);
    expect(erGyldigKlokkeslett("9:3")).toBe(false);
    expect(erGyldigKlokkeslett("")).toBe(false);
    expect(erGyldigKlokkeslett(null)).toBe(false);
  });
});

describe("validerKlStartSlutt", () => {
  it("returnerer null når begge er udefinert", () => {
    expect(validerKlStartSlutt(undefined, undefined)).toBeNull();
  });

  it("returnerer null for et gyldig par", () => {
    expect(validerKlStartSlutt("09:00", "15:00")).toBeNull();
  });

  it("returnerer en feilmelding når kun fraKl er satt", () => {
    expect(validerKlStartSlutt("09:00", undefined)).toEqual(expect.any(String));
  });

  it("returnerer en feilmelding når kun tilKl er satt", () => {
    expect(validerKlStartSlutt(undefined, "15:00")).toEqual(expect.any(String));
  });

  it("returnerer en feilmelding når fraKl er etter tilKl", () => {
    expect(validerKlStartSlutt("15:00", "09:00")).toEqual(expect.any(String));
  });

  it("returnerer en feilmelding når fraKl og tilKl er like", () => {
    expect(validerKlStartSlutt("09:00", "09:00")).toEqual(expect.any(String));
  });
});

describe("settTilgjengelighet", () => {
  it("oppretter én rad uten gjentaUkerAntall", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const rader = await settTilgjengelighet(prisma, {
      brukerId: bruker.id,
      dato: new Date("2026-11-02T00:00:00.000Z"),
      status: "ledig",
    });

    expect(rader).toHaveLength(1);
    expect(rader[0].brukerId).toBe(bruker.id);
    expect(rader[0].status).toBe("ledig");
    expect(await prisma.tilgjengelighet.count()).toBe(1);
  });

  it("konvergerer til én rad per dag ved gjentatt kall for samme (brukerId, dato)", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const dato = new Date("2026-11-02T00:00:00.000Z");

    await settTilgjengelighet(prisma, { brukerId: bruker.id, dato, status: "ledig" });
    await settTilgjengelighet(prisma, { brukerId: bruker.id, dato, status: "ikke_ledig" });

    const rader = await prisma.tilgjengelighet.findMany({ where: { brukerId: bruker.id } });
    expect(rader).toHaveLength(1);
    expect(rader[0].status).toBe("ikke_ledig");
  });

  it("oppretter 4 rader, én per uke, med samme gjentakelseId", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const rader = await settTilgjengelighet(prisma, {
      brukerId: bruker.id,
      dato: new Date("2026-11-02T00:00:00.000Z"),
      status: "ledig",
      gjentaUkerAntall: 4,
    });

    expect(rader).toHaveLength(4);
    const gjentakelseIder = new Set(rader.map((r) => r.gjentakelseId));
    expect(gjentakelseIder.size).toBe(1);
    expect(rader[0].gjentakelseId).not.toBeNull();
    expect(await prisma.tilgjengelighet.count({ where: { brukerId: bruker.id } })).toBe(4);
  });
});

describe("hentTilgjengelighetForPeriode", () => {
  it("returnerer kun rader innenfor perioden, med brukernavn", async () => {
    const prisma = await createTestDb();
    const bruker1 = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const bruker2 = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });

    await settTilgjengelighet(prisma, { brukerId: bruker1.id, dato: new Date("2026-11-02T00:00:00.000Z"), status: "ledig" });
    await settTilgjengelighet(prisma, { brukerId: bruker2.id, dato: new Date("2026-11-05T00:00:00.000Z"), status: "ikke_ledig" });
    await settTilgjengelighet(prisma, { brukerId: bruker1.id, dato: new Date("2026-12-01T00:00:00.000Z"), status: "ledig" });

    const rader = await hentTilgjengelighetForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );

    expect(rader).toHaveLength(2);
    expect(rader.map((r) => r.brukerNavn).sort()).toEqual(["Magnus", "Øystein"]);
  });
});

describe("tellLedigePerDag", () => {
  it("grupperer etter dato og teller status 'ledig'", () => {
    const rader = [
      { dato: "2026-11-02", status: "ledig" },
      { dato: "2026-11-02", status: "ledig" },
      { dato: "2026-11-02", status: "ikke_ledig" },
      { dato: "2026-11-03", status: "ledig" },
    ];

    expect(tellLedigePerDag(rader)).toEqual({ "2026-11-02": 2, "2026-11-03": 1 });
  });

  it("returnerer tomt objekt for tom liste", () => {
    expect(tellLedigePerDag([])).toEqual({});
  });
});

describe("slettTilgjengelighet", () => {
  it("sletter raden når eieren ber om det", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const [rad] = await settTilgjengelighet(prisma, { brukerId: bruker.id, dato: new Date("2026-11-02T00:00:00.000Z"), status: "ledig" });

    await slettTilgjengelighet(prisma, rad.id, bruker.id);

    const rader = await hentTilgjengelighetForPeriode(
      prisma,
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T00:00:00.000Z")
    );
    expect(rader).toHaveLength(0);
  });

  it("kaster feil når en annen bruker enn eieren prøver å slette", async () => {
    const prisma = await createTestDb();
    const eier = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const annen = await prisma.adminUser.create({ data: { brukernavn: "oystein", passord: "x", navn: "Øystein", rolle: "eier" } });
    const [rad] = await settTilgjengelighet(prisma, { brukerId: eier.id, dato: new Date("2026-11-02T00:00:00.000Z"), status: "ledig" });

    await expect(slettTilgjengelighet(prisma, rad.id, annen.id)).rejects.toThrow(TILGJENGELIGHET_EIER_FEIL);

    expect(await prisma.tilgjengelighet.count()).toBe(1);
  });

  it("kaster feil for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    await expect(slettTilgjengelighet(prisma, 999999, bruker.id)).rejects.toThrow(TILGJENGELIGHET_EIER_FEIL);
  });
});
