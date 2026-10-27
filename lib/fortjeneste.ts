import type { PrismaClient } from "@/app/generated/prisma/client";
import { beregnEierandeler } from "./kapitalinnskudd";
import { beregnTotalUtgifter } from "./utgift";
import { hentInnstilling } from "./innstilling";

export type FortjenesteResultat =
  | { beregnet: false; grunn: string }
  | {
      beregnet: true;
      kjopesum: number;
      salgssum: number;
      totalUtgifter: number;
      fortjeneste: number;
      likedelProsent: number;
      arbeidstimerAndelProsent: number;
      kapitalAndelProsent: number;
      arbeidstimerFallbackBrukt: boolean;
      kapitalFallbackBrukt: boolean;
      perEier: Array<{
        brukerId: number;
        brukerNavn: string;
        arbeidsandelProsent: number;
        kapitalandelProsent: number;
        likedel: number;
        arbeidsdel: number;
        kapitaldel: number;
        totalt: number;
      }>;
    };

export async function beregnArbeidstimerAndeler(
  prisma: PrismaClient,
  eiendomId: number
): Promise<Array<{ brukerId: number; brukerNavn: string; timer: number; andelProsent: number }>> {
  const eiere = await prisma.adminUser.findMany({ where: { rolle: "eier" } });
  const eierIder = new Set(eiere.map((e) => e.id));

  const registreringer = await prisma.timeregistrering.findMany({
    where: { brukerId: { in: [...eierIder] }, delprosjekt: { eiendomId } },
  });

  const timerPerBruker = new Map<number, number>();
  for (const rad of registreringer) {
    timerPerBruker.set(rad.brukerId, (timerPerBruker.get(rad.brukerId) ?? 0) + rad.antallTimer);
  }

  const totalTimer = registreringer.reduce((sum, rad) => sum + rad.antallTimer, 0);

  const resultat = eiere.map((eier) => {
    const timer = timerPerBruker.get(eier.id) ?? 0;
    return {
      brukerId: eier.id,
      brukerNavn: eier.navn,
      timer,
      andelProsent: totalTimer > 0 ? (timer / totalTimer) * 100 : 0,
    };
  });

  return resultat.sort((a, b) => b.timer - a.timer || a.brukerNavn.localeCompare(b.brukerNavn));
}

export async function beregnFortjenestefordeling(
  prisma: PrismaClient,
  eiendomId: number
): Promise<FortjenesteResultat> {
  const bolig = await prisma.bolig.findUnique({
    where: { id: eiendomId },
    select: { kjopesum: true, salgssum: true },
  });

  if (!bolig) {
    return { beregnet: false, grunn: "Fant ikke eiendommen." };
  }

  if (bolig.kjopesum == null || bolig.salgssum == null) {
    return { beregnet: false, grunn: "Kjøpesum og salgssum må være satt for å beregne fortjenestefordeling." };
  }

  const { kjopesum, salgssum } = bolig;

  const [totalUtgifter, kapitalandeler, arbeidstimerAndeler, innstilling] = await Promise.all([
    beregnTotalUtgifter(prisma, eiendomId),
    beregnEierandeler(prisma, eiendomId),
    beregnArbeidstimerAndeler(prisma, eiendomId),
    hentInnstilling(prisma),
  ]);

  const { arbeidstimerAndelProsent, kapitalAndelProsent } = innstilling;
  const likedelProsent = 100 - arbeidstimerAndelProsent - kapitalAndelProsent;
  const fortjeneste = salgssum - kjopesum - totalUtgifter;

  const totalKapital = kapitalandeler.reduce((sum, e) => sum + e.belop, 0);
  const totalTimer = arbeidstimerAndeler.reduce((sum, e) => sum + e.timer, 0);
  const kapitalFallbackBrukt = totalKapital === 0;
  const arbeidstimerFallbackBrukt = totalTimer === 0;

  const antallEiere = kapitalandeler.length;
  const arbeidsandelPerBruker = new Map(arbeidstimerAndeler.map((e) => [e.brukerId, e.andelProsent]));

  const perEier = kapitalandeler.map((eier) => {
    const kapitalandelProsent = kapitalFallbackBrukt ? 100 / antallEiere : eier.andelProsent;
    const arbeidsandelProsent = arbeidstimerFallbackBrukt
      ? 100 / antallEiere
      : arbeidsandelPerBruker.get(eier.brukerId) ?? 0;

    const likedel = (fortjeneste * (likedelProsent / 100)) / antallEiere;
    const arbeidsdel = fortjeneste * (arbeidstimerAndelProsent / 100) * (arbeidsandelProsent / 100);
    const kapitaldel = fortjeneste * (kapitalAndelProsent / 100) * (kapitalandelProsent / 100);
    const totalt = likedel + arbeidsdel + kapitaldel;

    return {
      brukerId: eier.brukerId,
      brukerNavn: eier.brukerNavn,
      arbeidsandelProsent,
      kapitalandelProsent,
      likedel,
      arbeidsdel,
      kapitaldel,
      totalt,
    };
  });

  return {
    beregnet: true,
    kjopesum,
    salgssum,
    totalUtgifter,
    fortjeneste,
    likedelProsent,
    arbeidstimerAndelProsent,
    kapitalAndelProsent,
    arbeidstimerFallbackBrukt,
    kapitalFallbackBrukt,
    perEier,
  };
}
