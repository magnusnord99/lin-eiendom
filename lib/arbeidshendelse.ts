import type { PrismaClient, Arbeidshendelse } from "@/app/generated/prisma/client";

export const ARBEIDSHENDELSE_FEIL = "Fant ikke arbeidshendelsen.";

export async function opprettArbeidshendelse(
  prisma: PrismaClient,
  input: {
    eiendomId: number;
    tittel: string;
    beskrivelse?: string;
    dato: Date;
    fraKl?: string;
    tilKl?: string;
    opprettetAvBrukerId: number;
  }
): Promise<Arbeidshendelse> {
  return prisma.arbeidshendelse.create({
    data: {
      eiendomId: input.eiendomId,
      tittel: input.tittel,
      beskrivelse: input.beskrivelse,
      dato: input.dato,
      fraKl: input.fraKl,
      tilKl: input.tilKl,
      opprettetAvBrukerId: input.opprettetAvBrukerId,
    },
  });
}

export async function hentArbeidshendelserForPeriode(
  prisma: PrismaClient,
  fraDato: Date,
  tilDato: Date
): Promise<
  Array<{
    id: number;
    eiendomId: number;
    eiendomTittel: string;
    tittel: string;
    beskrivelse: string | null;
    dato: Date;
    fraKl: string | null;
    tilKl: string | null;
  }>
> {
  const rader = await prisma.arbeidshendelse.findMany({
    where: { dato: { gte: fraDato, lte: tilDato } },
    include: { eiendom: { select: { tittel: true } } },
    orderBy: { dato: "asc" },
  });

  return rader.map((rad) => ({
    id: rad.id,
    eiendomId: rad.eiendomId,
    eiendomTittel: rad.eiendom.tittel,
    tittel: rad.tittel,
    beskrivelse: rad.beskrivelse,
    dato: rad.dato,
    fraKl: rad.fraKl,
    tilKl: rad.tilKl,
  }));
}

export async function slettArbeidshendelse(prisma: PrismaClient, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(ARBEIDSHENDELSE_FEIL);
  }

  const resultat = await prisma.arbeidshendelse.deleteMany({ where: { id } });

  if (resultat.count === 0) {
    throw new Error(ARBEIDSHENDELSE_FEIL);
  }
}

export async function harArbeidshendelser(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.arbeidshendelse.count({ where: { eiendomId } })) > 0;
}
