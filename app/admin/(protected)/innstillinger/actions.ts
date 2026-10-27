"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { oppdaterInnstilling, INNSTILLING_FEIL } from "@/lib/innstilling";

export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function oppdaterInnstillingAction(input: {
  arbeidstimerAndelProsent: number;
  kapitalAndelProsent: number;
}): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await oppdaterInnstilling(prisma, input);
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === INNSTILLING_FEIL) {
      return { ok: false, feilmelding: INNSTILLING_FEIL };
    }
    console.error("Uventet feil ved oppdatering av innstilling:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
