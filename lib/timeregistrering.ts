import type { PrismaClient, Timeregistrering } from "@/app/generated/prisma/client";

export const TIMEREGISTRERING_EIER_FEIL =
  "Fant ikke registrering, eller du har ikke tilgang til å slette den.";

export async function opprettTimeregistrering(
  prisma: PrismaClient,
  input: { delprosjektId: number; brukerId: number; dato: Date; antallTimer: number; beskrivelse?: string }
): Promise<Timeregistrering> {
  return prisma.timeregistrering.create({
    data: {
      delprosjektId: input.delprosjektId,
      brukerId: input.brukerId,
      dato: input.dato,
      antallTimer: input.antallTimer,
      beskrivelse: input.beskrivelse,
    },
  });
}

export async function hentTimerForEiendom(
  prisma: PrismaClient,
  eiendomId: number
): Promise<
  Array<{
    id: number;
    dato: Date;
    antallTimer: number;
    beskrivelse: string | null;
    delprosjektId: number;
    delprosjektNavn: string;
    brukerId: number;
    brukerNavn: string;
  }>
> {
  const rader = await prisma.timeregistrering.findMany({
    where: { delprosjekt: { eiendomId } },
    include: { delprosjekt: true, bruker: true },
    orderBy: { dato: "desc" },
  });

  return rader.map((rad) => ({
    id: rad.id,
    dato: rad.dato,
    antallTimer: rad.antallTimer,
    beskrivelse: rad.beskrivelse,
    delprosjektId: rad.delprosjektId,
    delprosjektNavn: rad.delprosjekt.navn,
    brukerId: rad.brukerId,
    brukerNavn: rad.bruker.navn,
  }));
}

export async function slettTimeregistrering(prisma: PrismaClient, id: number, brukerId: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(TIMEREGISTRERING_EIER_FEIL);
  }

  const resultat = await prisma.timeregistrering.deleteMany({ where: { id, brukerId } });

  if (resultat.count === 0) {
    throw new Error(TIMEREGISTRERING_EIER_FEIL);
  }
}
