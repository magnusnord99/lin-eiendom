import type { PrismaClient, Prisma } from "@/app/generated/prisma/client";
import { OFFENTLIG_SYNLIGE_STATUSER } from "@/lib/eiendom-status";

// Eksplisitt projeksjon for alt som eksponeres offentlig. Interne felt
// (kjopesum, kjopsdato, finansiering, estimerte verdier, aktiv, oppdatert)
// er bevisst utelatt.
export const OFFENTLIG_BOLIG_FELTER = {
  id: true,
  tittel: true,
  adresse: true,
  by: true,
  pris: true,
  type: true,
  storrelse: true,
  rom: true,
  bad: true,
  beskrivelse: true,
  bilder: true,
  lat: true,
  lng: true,
  status: true,
  opprettet: true,
} satisfies Prisma.BoligSelect;

export type OffentligBolig = Prisma.BoligGetPayload<{ select: typeof OFFENTLIG_BOLIG_FELTER }>;

export async function hentOffentligSynligeBoliger(
  prisma: PrismaClient,
  opts?: { type?: string; by?: string; take?: number }
): Promise<OffentligBolig[]> {
  return prisma.bolig.findMany({
    where: {
      status: { in: OFFENTLIG_SYNLIGE_STATUSER },
      ...(opts?.type ? { type: opts.type } : {}),
      ...(opts?.by ? { by: { contains: opts.by } } : {}),
    },
    select: OFFENTLIG_BOLIG_FELTER,
    orderBy: { opprettet: "desc" },
    take: opts?.take,
  });
}

export async function hentOffentligSynligBolig(
  prisma: PrismaClient,
  id: number,
  type?: string
): Promise<OffentligBolig | null> {
  return prisma.bolig.findFirst({
    where: {
      id,
      status: { in: OFFENTLIG_SYNLIGE_STATUSER },
      ...(type ? { type } : {}),
    },
    select: OFFENTLIG_BOLIG_FELTER,
  });
}
