import type { PrismaClient, Dokument } from "@/app/generated/prisma/client";

export const DOKUMENT_KATEGORIER = ["kontrakt", "faktura", "kvittering", "bilde", "tegning", "annet"] as const;
export type DokumentKategori = (typeof DOKUMENT_KATEGORIER)[number];

export function erGyldigDokumentKategori(verdi: unknown): verdi is DokumentKategori {
  return typeof verdi === "string" && (DOKUMENT_KATEGORIER as readonly string[]).includes(verdi);
}

export const KATEGORI_LABELS: Record<DokumentKategori, string> = {
  kontrakt: "Kontrakt",
  faktura: "Faktura",
  kvittering: "Kvittering",
  bilde: "Bilde",
  tegning: "Tegning",
  annet: "Annet",
};

export const DOKUMENT_FEIL = "Fant ikke dokumentet.";

export async function opprettDokument(
  prisma: PrismaClient,
  input: {
    eiendomId: number;
    delprosjektId?: number;
    kategori: DokumentKategori;
    navn: string;
    blobPathname: string;
    mimeType: string;
    storrelse: number;
    opplastetAvBrukerId: number;
  }
): Promise<Dokument> {
  return prisma.dokument.create({
    data: {
      eiendomId: input.eiendomId,
      delprosjektId: input.delprosjektId,
      kategori: input.kategori,
      navn: input.navn,
      blobPathname: input.blobPathname,
      mimeType: input.mimeType,
      storrelse: input.storrelse,
      opplastetAvBrukerId: input.opplastetAvBrukerId,
    },
  });
}

export async function hentDokumenterForEiendom(
  prisma: PrismaClient,
  eiendomId: number
): Promise<
  Array<{
    id: number;
    kategori: string;
    navn: string;
    mimeType: string;
    storrelse: number;
    opprettet: Date;
    delprosjektId: number | null;
    delprosjektNavn: string | null;
    opplastetAvBrukerId: number;
    opplastetAvNavn: string;
  }>
> {
  const rader = await prisma.dokument.findMany({
    where: { eiendomId },
    select: {
      id: true,
      kategori: true,
      navn: true,
      mimeType: true,
      storrelse: true,
      opprettet: true,
      delprosjektId: true,
      opplastetAvBrukerId: true,
      delprosjekt: { select: { navn: true } },
      opplastetAvBruker: { select: { navn: true } },
    },
    orderBy: { opprettet: "desc" },
  });

  return rader.map((rad) => ({
    id: rad.id,
    kategori: rad.kategori,
    navn: rad.navn,
    mimeType: rad.mimeType,
    storrelse: rad.storrelse,
    opprettet: rad.opprettet,
    delprosjektId: rad.delprosjektId,
    delprosjektNavn: rad.delprosjekt?.navn ?? null,
    opplastetAvBrukerId: rad.opplastetAvBrukerId,
    opplastetAvNavn: rad.opplastetAvBruker.navn,
  }));
}

export async function hentDokumentForNedlasting(
  prisma: PrismaClient,
  id: number
): Promise<{ blobPathname: string; mimeType: string; navn: string } | null> {
  const rad = await prisma.dokument.findUnique({
    where: { id },
    select: { blobPathname: true, mimeType: true, navn: true },
  });

  return rad ?? null;
}

export async function slettDokumentRad(prisma: PrismaClient, id: number): Promise<{ blobPathname: string }> {
  const rad = await prisma.dokument.findUnique({ where: { id }, select: { blobPathname: true } });

  if (!rad) {
    throw new Error(DOKUMENT_FEIL);
  }

  await prisma.dokument.delete({ where: { id } });

  return { blobPathname: rad.blobPathname };
}

export async function hentDelprosjektEiendomId(prisma: PrismaClient, delprosjektId: number): Promise<number | null> {
  const rad = await prisma.delprosjekt.findUnique({ where: { id: delprosjektId }, select: { eiendomId: true } });
  return rad?.eiendomId ?? null;
}

export async function harDokumenter(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.dokument.count({ where: { eiendomId } })) > 0;
}
