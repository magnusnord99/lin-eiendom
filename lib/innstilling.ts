import type { PrismaClient } from "@/app/generated/prisma/client";

export const INNSTILLING_FEIL = "Ugyldig prosentfordeling.";

export async function hentInnstilling(
  prisma: PrismaClient
): Promise<{ arbeidstimerAndelProsent: number; kapitalAndelProsent: number }> {
  const rad = await prisma.innstilling.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, arbeidstimerAndelProsent: 10, kapitalAndelProsent: 10 },
  });

  return {
    arbeidstimerAndelProsent: rad.arbeidstimerAndelProsent,
    kapitalAndelProsent: rad.kapitalAndelProsent,
  };
}

export async function oppdaterInnstilling(
  prisma: PrismaClient,
  input: { arbeidstimerAndelProsent: number; kapitalAndelProsent: number }
): Promise<void> {
  const { arbeidstimerAndelProsent, kapitalAndelProsent } = input;

  if (
    !Number.isFinite(arbeidstimerAndelProsent) ||
    !Number.isFinite(kapitalAndelProsent) ||
    arbeidstimerAndelProsent < 0 ||
    arbeidstimerAndelProsent > 100 ||
    kapitalAndelProsent < 0 ||
    kapitalAndelProsent > 100 ||
    arbeidstimerAndelProsent + kapitalAndelProsent > 100
  ) {
    throw new Error(INNSTILLING_FEIL);
  }

  // Bygg skrivepayloaden fra navngitte felt. Aldri spre `input` direkte inn i
  // Prisma-kallet: inputs TypeScript-type stopper ikke en kaller fra å sende
  // et ekstra runtime-felt (f.eks. id) som ville overstyrt singleton-raden.
  const felter = {
    arbeidstimerAndelProsent,
    kapitalAndelProsent,
  };

  await prisma.innstilling.upsert({
    where: { id: 1 },
    update: felter,
    create: { id: 1, ...felter },
  });
}
