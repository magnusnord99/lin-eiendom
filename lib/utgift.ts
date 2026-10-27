import type { PrismaClient, Utgift } from "@/app/generated/prisma/client";

export const UTGIFT_FEIL = "Fant ikke utgiften.";
export const UTGIFT_KVITTERING_FOR_STOR = "Kvitteringsbildet er for stort (maks 4 MB).";
export const UTGIFT_KVITTERING_UGYLDIG_FORMAT = "Ugyldig bildeformat. Kun JPEG, PNG, WebP og GIF er støttet.";

export async function opprettUtgift(
  prisma: PrismaClient,
  input: {
    eiendomId: number;
    delprosjektId?: number;
    dato: Date;
    kategori: string;
    beskrivelse?: string;
    leverandor?: string;
    belop: number;
    betaltAvBrukerId?: number;
  }
): Promise<Utgift> {
  return prisma.utgift.create({
    data: {
      eiendomId: input.eiendomId,
      delprosjektId: input.delprosjektId,
      dato: input.dato,
      kategori: input.kategori,
      beskrivelse: input.beskrivelse,
      leverandor: input.leverandor,
      belop: input.belop,
      betaltAvBrukerId: input.betaltAvBrukerId,
    },
  });
}

export async function hentUtgifterForEiendom(
  prisma: PrismaClient,
  eiendomId: number
): Promise<
  Array<{
    id: number;
    dato: Date;
    kategori: string;
    beskrivelse: string | null;
    leverandor: string | null;
    belop: number;
    harKvittering: boolean;
    delprosjektId: number | null;
    delprosjektNavn: string | null;
    betaltAvBrukerId: number | null;
    betaltAvNavn: string | null;
  }>
> {
  const rader = await prisma.utgift.findMany({
    where: { eiendomId },
    select: {
      id: true,
      dato: true,
      kategori: true,
      beskrivelse: true,
      leverandor: true,
      belop: true,
      kvitteringMimeType: true,
      delprosjektId: true,
      betaltAvBrukerId: true,
      delprosjekt: { select: { navn: true } },
      betaltAvBruker: { select: { navn: true } },
    },
    orderBy: [{ dato: "desc" }, { id: "desc" }],
  });

  return rader.map((rad) => ({
    id: rad.id,
    dato: rad.dato,
    kategori: rad.kategori,
    beskrivelse: rad.beskrivelse,
    leverandor: rad.leverandor,
    belop: rad.belop,
    harKvittering: rad.kvitteringMimeType != null,
    delprosjektId: rad.delprosjektId,
    delprosjektNavn: rad.delprosjekt?.navn ?? null,
    betaltAvBrukerId: rad.betaltAvBrukerId,
    betaltAvNavn: rad.betaltAvBruker?.navn ?? null,
  }));
}

export async function hentKvittering(
  prisma: PrismaClient,
  id: number
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const rad = await prisma.utgift.findUnique({
    where: { id },
    select: { kvitteringBilde: true, kvitteringMimeType: true },
  });

  if (!rad || rad.kvitteringBilde == null || rad.kvitteringMimeType == null) {
    return null;
  }

  return { bytes: Buffer.from(rad.kvitteringBilde), mimeType: rad.kvitteringMimeType };
}

export function detekterBildeformat(bytes: Buffer): string | null {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (startsWithAscii(bytes, "GIF87a", 0) || startsWithAscii(bytes, "GIF89a", 0)) {
    return "image/gif";
  }

  if (startsWithAscii(bytes, "RIFF", 0) && startsWithAscii(bytes, "WEBP", 8)) {
    return "image/webp";
  }

  return null;
}

function startsWithBytes(bytes: Buffer, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function startsWithAscii(bytes: Buffer, ascii: string, offset: number): boolean {
  if (bytes.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

export async function lagreKvittering(prisma: PrismaClient, utgiftId: number, bytes: Buffer): Promise<void> {
  if (bytes.length > 4_000_000) {
    throw new Error(UTGIFT_KVITTERING_FOR_STOR);
  }

  const mimeType = detekterBildeformat(bytes);
  if (mimeType == null) {
    throw new Error(UTGIFT_KVITTERING_UGYLDIG_FORMAT);
  }

  const resultat = await prisma.utgift.updateMany({
    where: { id: utgiftId },
    data: { kvitteringBilde: bytes as unknown as Uint8Array<ArrayBuffer>, kvitteringMimeType: mimeType },
  });

  if (resultat.count === 0) {
    throw new Error(UTGIFT_FEIL);
  }
}

export async function beregnFaktiskPerDelprosjekt(
  prisma: PrismaClient,
  eiendomId: number
): Promise<Map<number, number>> {
  const rader = await prisma.utgift.findMany({
    where: { eiendomId, delprosjektId: { not: null } },
    select: { delprosjektId: true, belop: true },
  });

  const sumPerDelprosjekt = new Map<number, number>();
  for (const rad of rader) {
    if (rad.delprosjektId == null) continue;
    sumPerDelprosjekt.set(rad.delprosjektId, (sumPerDelprosjekt.get(rad.delprosjektId) ?? 0) + rad.belop);
  }

  return sumPerDelprosjekt;
}

export async function slettUtgift(prisma: PrismaClient, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(UTGIFT_FEIL);
  }

  const resultat = await prisma.utgift.deleteMany({ where: { id } });

  if (resultat.count === 0) {
    throw new Error(UTGIFT_FEIL);
  }
}

export async function harUtgifter(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.utgift.count({ where: { eiendomId } })) > 0;
}
