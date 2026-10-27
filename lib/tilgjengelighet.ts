import crypto from "node:crypto";
import type { PrismaClient, Tilgjengelighet } from "@/app/generated/prisma/client";

export const TILGJENGELIGHET_STATUSER = ["ledig", "ikke_ledig"] as const;
export type TilgjengelighetStatus = (typeof TILGJENGELIGHET_STATUSER)[number];

export function erGyldigTilgjengelighetStatus(verdi: unknown): verdi is TilgjengelighetStatus {
  return typeof verdi === "string" && (TILGJENGELIGHET_STATUSER as readonly string[]).includes(verdi);
}

export const TILGJENGELIGHET_EIER_FEIL = "Fant ikke registrering, eller du har ikke tilgang til å slette den.";

export function erGyldigKlokkeslett(verdi: unknown): verdi is string {
  return typeof verdi === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(verdi);
}

export function validerKlStartSlutt(fraKl?: string, tilKl?: string): string | null {
  if (fraKl === undefined && tilKl === undefined) {
    return null;
  }

  if (fraKl === undefined || tilKl === undefined) {
    return "Både fra- og til-klokkeslett må fylles ut.";
  }

  if (!erGyldigKlokkeslett(fraKl) || !erGyldigKlokkeslett(tilKl)) {
    return "Ugyldig klokkeslett. Bruk formatet TT:MM.";
  }

  if (fraKl >= tilKl) {
    return "Fra-klokkeslett må være før til-klokkeslett.";
  }

  return null;
}

export const MAKS_GJENTAKELSER = 26;

export async function settTilgjengelighet(
  prisma: PrismaClient,
  input: {
    brukerId: number;
    dato: Date;
    status: TilgjengelighetStatus;
    fraKl?: string;
    tilKl?: string;
    gjentaUkerAntall?: number;
  }
): Promise<Tilgjengelighet[]> {
  const antall = input.gjentaUkerAntall ?? 1;

  if (antall <= 1) {
    const rad = await prisma.tilgjengelighet.upsert({
      where: { brukerId_dato: { brukerId: input.brukerId, dato: input.dato } },
      create: {
        brukerId: input.brukerId,
        dato: input.dato,
        status: input.status,
        fraKl: input.fraKl,
        tilKl: input.tilKl,
      },
      update: {
        status: input.status,
        fraKl: input.fraKl,
        tilKl: input.tilKl,
      },
    });

    return [rad];
  }

  const gjentakelseId = crypto.randomUUID();
  const rader: Tilgjengelighet[] = [];

  for (let i = 0; i < antall; i++) {
    const dato = new Date(input.dato.getTime() + 7 * i * 86_400_000);
    const rad = await prisma.tilgjengelighet.upsert({
      where: { brukerId_dato: { brukerId: input.brukerId, dato } },
      create: {
        brukerId: input.brukerId,
        dato,
        status: input.status,
        fraKl: input.fraKl,
        tilKl: input.tilKl,
        gjentakelseId,
      },
      update: {
        status: input.status,
        fraKl: input.fraKl,
        tilKl: input.tilKl,
        gjentakelseId,
      },
    });
    rader.push(rad);
  }

  return rader;
}

export async function hentTilgjengelighetForPeriode(
  prisma: PrismaClient,
  fraDato: Date,
  tilDato: Date
): Promise<
  Array<{
    id: number;
    brukerId: number;
    brukerNavn: string;
    dato: Date;
    status: TilgjengelighetStatus;
    fraKl: string | null;
    tilKl: string | null;
  }>
> {
  const rader = await prisma.tilgjengelighet.findMany({
    where: { dato: { gte: fraDato, lte: tilDato } },
    include: { bruker: { select: { navn: true } } },
    orderBy: [{ dato: "asc" }, { brukerId: "asc" }],
  });

  return rader.map((rad) => ({
    id: rad.id,
    brukerId: rad.brukerId,
    brukerNavn: rad.bruker.navn,
    dato: rad.dato,
    status: rad.status as TilgjengelighetStatus,
    fraKl: rad.fraKl,
    tilKl: rad.tilKl,
  }));
}

export function tellLedigePerDag(rader: Array<{ dato: string; status: string }>): Record<string, number> {
  return rader.reduce<Record<string, number>>((teller, rad) => {
    if (!(rad.dato in teller)) {
      teller[rad.dato] = 0;
    }
    if (rad.status === "ledig") {
      teller[rad.dato] += 1;
    }
    return teller;
  }, {});
}

export async function slettTilgjengelighet(prisma: PrismaClient, id: number, brukerId: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(TILGJENGELIGHET_EIER_FEIL);
  }

  const resultat = await prisma.tilgjengelighet.deleteMany({ where: { id, brukerId } });

  if (resultat.count === 0) {
    throw new Error(TILGJENGELIGHET_EIER_FEIL);
  }
}
