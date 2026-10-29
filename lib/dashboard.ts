import type { PrismaClient } from "@/app/generated/prisma/client";

export type EiendomOversiktRad = {
  id: number;
  tittel: string;
  totalUtgift: number;
  totalBudsjett: number;
  antallDelprosjekter: number;
  antallMedBudsjett: number;
};

// Same idiom as `dagensDatoOslo()` in TimeregistreringPanel.tsx/UtgiftPanel.tsx/
// KapitalPanel.tsx/kalender/page.tsx: the Oslo calendar date (not the UTC one) is
// what decides which calendar month a timestamp belongs to. `Utgift.dato` (and every
// other `dato` field in this codebase) is stored as UTC-midnight, so the month
// boundaries below are themselves built as UTC-midnight `Date`s.
export function manedsgrenserOslo(naa: Date = new Date()): { start: Date; sluttEksklusiv: Date } {
  const datoNokkel = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(naa);
  const [aar, maaned] = datoNokkel.split("-").map(Number);

  return {
    start: new Date(Date.UTC(aar, maaned - 1, 1)),
    sluttEksklusiv: new Date(Date.UTC(aar, maaned, 1)),
  };
}

export async function hentTotalInvestert(prisma: PrismaClient): Promise<number> {
  // Samme definisjon av "investert" som `beregnEierandeler` i lib/kapitalinnskudd.ts:
  // kun kapitalinnskudd fra brukere med rolle "eier" teller.
  const resultat = await prisma.kapitalinnskudd.aggregate({
    where: { bruker: { rolle: "eier" } },
    _sum: { belop: true },
  });
  return resultat._sum.belop ?? 0;
}

export async function hentTotalUtgifterDenneManeden(prisma: PrismaClient, naa?: Date): Promise<number> {
  const { start, sluttEksklusiv } = manedsgrenserOslo(naa);

  const resultat = await prisma.utgift.aggregate({
    where: { dato: { gte: start, lt: sluttEksklusiv } },
    _sum: { belop: true },
  });

  return resultat._sum.belop ?? 0;
}

export async function hentEiendomOversikt(prisma: PrismaClient): Promise<EiendomOversiktRad[]> {
  const eiendommer = await prisma.bolig.findMany({
    select: { id: true, tittel: true },
    orderBy: { tittel: "asc" },
  });

  const utgiftPerEiendom = await prisma.utgift.groupBy({
    by: ["eiendomId"],
    _sum: { belop: true },
  });
  const utgiftMap = new Map<number, number>(
    utgiftPerEiendom.map((rad) => [rad.eiendomId, rad._sum.belop ?? 0])
  );

  const delprosjekter = await prisma.delprosjekt.findMany({
    select: { eiendomId: true, budsjett: true },
  });

  type DelprosjektAggregat = { totalBudsjett: number; antallDelprosjekter: number; antallMedBudsjett: number };
  const delprosjektMap = new Map<number, DelprosjektAggregat>();
  for (const rad of delprosjekter) {
    const aggregat = delprosjektMap.get(rad.eiendomId) ?? {
      totalBudsjett: 0,
      antallDelprosjekter: 0,
      antallMedBudsjett: 0,
    };

    aggregat.antallDelprosjekter += 1;
    if (rad.budsjett != null) {
      aggregat.antallMedBudsjett += 1;
      aggregat.totalBudsjett += rad.budsjett;
    }

    delprosjektMap.set(rad.eiendomId, aggregat);
  }

  return eiendommer.map((eiendom) => {
    const delprosjektAggregat = delprosjektMap.get(eiendom.id);
    return {
      id: eiendom.id,
      tittel: eiendom.tittel,
      totalUtgift: utgiftMap.get(eiendom.id) ?? 0,
      totalBudsjett: delprosjektAggregat?.totalBudsjett ?? 0,
      antallDelprosjekter: delprosjektAggregat?.antallDelprosjekter ?? 0,
      antallMedBudsjett: delprosjektAggregat?.antallMedBudsjett ?? 0,
    };
  });
}
