import type { PrismaClient, Kapitalinnskudd } from "@/app/generated/prisma/client";

export const KAPITALINNSKUDD_FEIL = "Fant ikke innskuddet.";

export async function opprettKapitalinnskudd(
  prisma: PrismaClient,
  input: { eiendomId: number; brukerId: number; dato: Date; belop: number; beskrivelse?: string }
): Promise<Kapitalinnskudd> {
  return prisma.kapitalinnskudd.create({
    data: {
      eiendomId: input.eiendomId,
      brukerId: input.brukerId,
      dato: input.dato,
      belop: input.belop,
      beskrivelse: input.beskrivelse,
    },
  });
}

export async function hentInnskuddForEiendom(
  prisma: PrismaClient,
  eiendomId: number
): Promise<
  Array<{
    id: number;
    dato: Date;
    belop: number;
    beskrivelse: string | null;
    brukerId: number;
    brukerNavn: string;
  }>
> {
  const rader = await prisma.kapitalinnskudd.findMany({
    where: { eiendomId },
    include: { bruker: true },
    orderBy: [{ dato: "desc" }, { id: "desc" }],
  });

  return rader.map((rad) => ({
    id: rad.id,
    dato: rad.dato,
    belop: rad.belop,
    beskrivelse: rad.beskrivelse,
    brukerId: rad.brukerId,
    brukerNavn: rad.bruker.navn,
  }));
}

export async function beregnEierandeler(
  prisma: PrismaClient,
  eiendomId: number
): Promise<Array<{ brukerId: number; brukerNavn: string; belop: number; andelProsent: number }>> {
  const eiere = await prisma.adminUser.findMany({ where: { rolle: "eier" } });
  const eierIder = new Set(eiere.map((e) => e.id));

  const innskudd = await prisma.kapitalinnskudd.findMany({
    where: { eiendomId, brukerId: { in: [...eierIder] } },
  });

  const belopPerBruker = new Map<number, number>();
  for (const rad of innskudd) {
    belopPerBruker.set(rad.brukerId, (belopPerBruker.get(rad.brukerId) ?? 0) + rad.belop);
  }

  const totalBelop = innskudd.reduce((sum, rad) => sum + rad.belop, 0);

  const resultat = eiere.map((eier) => {
    const belop = belopPerBruker.get(eier.id) ?? 0;
    return {
      brukerId: eier.id,
      brukerNavn: eier.navn,
      belop,
      andelProsent: totalBelop > 0 ? (belop / totalBelop) * 100 : 0,
    };
  });

  return resultat.sort((a, b) => b.belop - a.belop || a.brukerNavn.localeCompare(b.brukerNavn));
}

export async function slettKapitalinnskudd(prisma: PrismaClient, id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(KAPITALINNSKUDD_FEIL);
  }

  const resultat = await prisma.kapitalinnskudd.deleteMany({ where: { id } });

  if (resultat.count === 0) {
    throw new Error(KAPITALINNSKUDD_FEIL);
  }
}

export async function harKapitalinnskudd(prisma: PrismaClient, eiendomId: number): Promise<boolean> {
  return (await prisma.kapitalinnskudd.count({ where: { eiendomId } })) > 0;
}
