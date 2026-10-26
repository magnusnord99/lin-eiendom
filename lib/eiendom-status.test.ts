// lib/eiendom-status.test.ts
import { describe, it, expect } from "vitest";
import { erOffentligSynlig, erGyldigStatus, utledStatusFraAktiv, erStatusGyldigForType, ALLE_STATUSER, STATUS_LABELS } from "./eiendom-status";

describe("erOffentligSynlig", () => {
  it.each([
    ["til_salgs", true],
    ["klar_for_utleie", true],
    ["vurderes", false],
    ["kjopt", false],
    ["planlegging", false],
    ["under_oppussing", false],
    ["utleid", false],
    ["solgt", false],
  ])("status %s gir synlighet %s", (status, forventet) => {
    expect(erOffentligSynlig(status)).toBe(forventet);
  });

  it("behandler ukjent/tom status som ikke synlig (fail-safe)", () => {
    expect(erOffentligSynlig("")).toBe(false);
    expect(erOffentligSynlig("noe-ukjent")).toBe(false);
  });
});

describe("erGyldigStatus", () => {
  it.each(["vurderes", "kjopt", "planlegging", "under_oppussing", "klar_for_utleie", "utleid", "til_salgs", "solgt"])(
    "%s er gyldig",
    (status) => {
      expect(erGyldigStatus(status)).toBe(true);
    }
  );

  it.each(["", "noe-ukjent", null, undefined, 123])("%s er ugyldig", (status) => {
    expect(erGyldigStatus(status)).toBe(false);
  });
});

describe("utledStatusFraAktiv", () => {
  it.each([
    [true, "salg", "til_salgs"],
    [true, "leie", "klar_for_utleie"],
    [false, "salg", "solgt"],
    [false, "leie", "utleid"],
  ])("aktiv=%s type=%s gir status %s", (aktiv, type, forventet) => {
    expect(utledStatusFraAktiv(aktiv, type)).toBe(forventet);
  });
});

describe("erStatusGyldigForType", () => {
  it.each([
    ["til_salgs", "salg", true],
    ["klar_for_utleie", "salg", false],
    ["klar_for_utleie", "leie", true],
    ["til_salgs", "leie", false],
    ["under_oppussing", "salg", true],
    ["under_oppussing", "leie", true],
  ])("status %s for type %s gir %s", (status, type, forventet) => {
    expect(erStatusGyldigForType(status, type)).toBe(forventet);
  });
});

describe("STATUS_LABELS", () => {
  it("har en norsk label for hver av de 8 statusene", () => {
    for (const status of ALLE_STATUSER) {
      expect(typeof STATUS_LABELS[status]).toBe("string");
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});
