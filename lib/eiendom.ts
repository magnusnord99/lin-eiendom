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

// Allowlist for hva API-rutene lar en klient skrive til en Bolig. Alle skalare
// kolonner unntatt id/opprettet/oppdatert (server-styrte); ingen relasjonsfelt.
// Dette hindrer at en nøstet Prisma-skriveoperasjon (f.eks. et forsøk på å
// slette eller flytte relaterte rader via en nøstet `update`) kan smugles
// gjennom disse endepunktene.
export const SKRIVBARE_BOLIG_SKALARFELTER = [
  "tittel", "adresse", "by", "pris", "type", "storrelse", "rom", "bad",
  "beskrivelse", "bilder", "lat", "lng", "aktiv", "status",
  "kjopesum", "kjopsdato", "finansiering", "estimertVerdiNa", "estimertVerdiEtterOppussing",
] as const;

export function plukkSkrivbareBoligFelter(input: Record<string, unknown>): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  for (const felt of SKRIVBARE_BOLIG_SKALARFELTER) {
    if (felt in input) resultat[felt] = input[felt];
  }
  return resultat;
}

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
  if (!Number.isInteger(id)) {
    return null;
  }

  return prisma.bolig.findFirst({
    where: {
      id,
      status: { in: OFFENTLIG_SYNLIGE_STATUSER },
      ...(type ? { type } : {}),
    },
    select: OFFENTLIG_BOLIG_FELTER,
  });
}
