import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import {
  DOKUMENT_KATEGORIER,
  DOKUMENT_FEIL,
  KATEGORI_LABELS,
  erGyldigDokumentKategori,
  opprettDokument,
  hentDokumenterForEiendom,
  hentDokumentForNedlasting,
  slettDokumentRad,
  hentDelprosjektEiendomId,
  harDokumenter,
} from "./dokument";

describe("erGyldigDokumentKategori", () => {
  it("returnerer true for alle gyldige kategorier", () => {
    for (const kategori of DOKUMENT_KATEGORIER) {
      expect(erGyldigDokumentKategori(kategori)).toBe(true);
    }
  });

  it("returnerer false for ugyldige verdier", () => {
    expect(erGyldigDokumentKategori("")).toBe(false);
    expect(erGyldigDokumentKategori("ukjent")).toBe(false);
    expect(erGyldigDokumentKategori(null)).toBe(false);
    expect(erGyldigDokumentKategori(undefined)).toBe(false);
    expect(erGyldigDokumentKategori(123)).toBe(false);
  });
});

describe("KATEGORI_LABELS", () => {
  it("har en ikke-tom norsk streng for hver kategori", () => {
    for (const kategori of DOKUMENT_KATEGORIER) {
      expect(typeof KATEGORI_LABELS[kategori]).toBe("string");
      expect(KATEGORI_LABELS[kategori].length).toBeGreaterThan(0);
    }
  });
});

describe("opprettDokument og hentDokumenterForEiendom", () => {
  it("lagrer et dokument og returnerer de lagrede feltene", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });

    const dokument = await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "kontrakt",
      navn: "kjopekontrakt.pdf",
      blobPathname: "boliger/1/kjopekontrakt.pdf",
      mimeType: "application/pdf",
      storrelse: 12345,
      opplastetAvBrukerId: bruker.id,
    });

    expect(dokument.eiendomId).toBe(eiendom.id);
    expect(dokument.kategori).toBe("kontrakt");
    expect(dokument.navn).toBe("kjopekontrakt.pdf");
    expect(dokument.blobPathname).toBe("boliger/1/kjopekontrakt.pdf");
    expect(dokument.mimeType).toBe("application/pdf");
    expect(dokument.storrelse).toBe(12345);
    expect(dokument.opplastetAvBrukerId).toBe(bruker.id);
    expect(dokument.delprosjektId).toBeNull();
  });

  it("returnerer begge dokumenter, nyeste først, med delprosjektnavn og opplasternavn", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Kjøkken" } });

    const forste = await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "faktura",
      navn: "faktura1.pdf",
      blobPathname: "boliger/1/faktura1.pdf",
      mimeType: "application/pdf",
      storrelse: 100,
      opplastetAvBrukerId: bruker.id,
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const andre = await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      delprosjektId: delprosjekt.id,
      kategori: "kvittering",
      navn: "kvittering1.pdf",
      blobPathname: "boliger/1/kvittering1.pdf",
      mimeType: "application/pdf",
      storrelse: 200,
      opplastetAvBrukerId: bruker.id,
    });

    const dokumenter = await hentDokumenterForEiendom(prisma, eiendom.id);

    expect(dokumenter).toHaveLength(2);
    expect(dokumenter.map((d) => d.id)).toEqual([andre.id, forste.id]);

    const medDelprosjekt = dokumenter.find((d) => d.id === andre.id);
    const utenDelprosjekt = dokumenter.find((d) => d.id === forste.id);
    expect(medDelprosjekt?.delprosjektId).toBe(delprosjekt.id);
    expect(medDelprosjekt?.delprosjektNavn).toBe("Kjøkken");
    expect(utenDelprosjekt?.delprosjektId).toBeNull();
    expect(utenDelprosjekt?.delprosjektNavn).toBeNull();
    expect(medDelprosjekt?.opplastetAvNavn).toBe("Magnus");
  });

  it("returnerer tom liste for en eiendom uten dokumenter", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    expect(await hentDokumenterForEiendom(prisma, eiendom.id)).toEqual([]);
  });

  it("inneholder aldri blobPathname i listen", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "bilde",
      navn: "bilde.jpg",
      blobPathname: "boliger/1/bilde.jpg",
      mimeType: "image/jpeg",
      storrelse: 500,
      opplastetAvBrukerId: bruker.id,
    });

    const dokumenter = await hentDokumenterForEiendom(prisma, eiendom.id);
    expect(dokumenter).toHaveLength(1);
    expect(dokumenter[0]).not.toHaveProperty("blobPathname");
  });
});

describe("hentDokumentForNedlasting", () => {
  it("returnerer blobPathname, mimeType og navn for et eksisterende dokument", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const dokument = await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "tegning",
      navn: "tegning.png",
      blobPathname: "boliger/1/tegning.png",
      mimeType: "image/png",
      storrelse: 999,
      opplastetAvBrukerId: bruker.id,
    });

    const resultat = await hentDokumentForNedlasting(prisma, dokument.id);

    expect(resultat).toEqual({
      blobPathname: "boliger/1/tegning.png",
      mimeType: "image/png",
      navn: "tegning.png",
    });
  });

  it("returnerer null for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();

    expect(await hentDokumentForNedlasting(prisma, 999999)).toBeNull();
  });
});

describe("slettDokumentRad", () => {
  it("sletter raden og returnerer blobPathname", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    const dokument = await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "annet",
      navn: "diverse.pdf",
      blobPathname: "boliger/1/diverse.pdf",
      mimeType: "application/pdf",
      storrelse: 42,
      opplastetAvBrukerId: bruker.id,
    });

    const resultat = await slettDokumentRad(prisma, dokument.id);

    expect(resultat).toEqual({ blobPathname: "boliger/1/diverse.pdf" });
    expect(await hentDokumenterForEiendom(prisma, eiendom.id)).toEqual([]);
  });

  it("kaster feil for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();

    await expect(slettDokumentRad(prisma, 999999)).rejects.toThrow(DOKUMENT_FEIL);
  });
});

describe("hentDelprosjektEiendomId", () => {
  it("returnerer eiendomId for et eksisterende delprosjekt", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const delprosjekt = await prisma.delprosjekt.create({ data: { eiendomId: eiendom.id, navn: "Bad" } });

    expect(await hentDelprosjektEiendomId(prisma, delprosjekt.id)).toBe(eiendom.id);
  });

  it("returnerer null for en ikke-eksisterende id", async () => {
    const prisma = await createTestDb();

    expect(await hentDelprosjektEiendomId(prisma, 999999)).toBeNull();
  });
});

describe("harDokumenter", () => {
  it("returnerer false når eiendommen ikke har noen dokumenter", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });

    expect(await harDokumenter(prisma, eiendom.id)).toBe(false);
  });

  it("returnerer true når eiendommen har minst ett dokument", async () => {
    const prisma = await createTestDb();
    const eiendom = await prisma.bolig.create({ data: { tittel: "A", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" } });
    const bruker = await prisma.adminUser.create({ data: { brukernavn: "magnus", passord: "x", navn: "Magnus", rolle: "eier" } });
    await opprettDokument(prisma, {
      eiendomId: eiendom.id,
      kategori: "annet",
      navn: "x.pdf",
      blobPathname: "boliger/1/x.pdf",
      mimeType: "application/pdf",
      storrelse: 1,
      opplastetAvBrukerId: bruker.id,
    });

    expect(await harDokumenter(prisma, eiendom.id)).toBe(true);
  });
});
