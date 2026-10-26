"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Kapitalinnskudd } from "@/app/generated/prisma/client";
import { opprettKapitalinnskudd, slettKapitalinnskudd, KAPITALINNSKUDD_FEIL } from "@/lib/kapitalinnskudd";

export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function registrerInnskuddAction(input: {
  eiendomId: number;
  brukerId: number;
  dato: string;
  belop: number;
  beskrivelse?: string;
}): Promise<HandlingResultat<Kapitalinnskudd>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  if (typeof input.dato !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dato)) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }
  const dato = new Date(`${input.dato}T00:00:00.000Z`);
  if (Number.isNaN(dato.getTime()) || dato.toISOString().slice(0, 10) !== input.dato) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }

  if (!Number.isInteger(input.belop) || input.belop <= 0 || input.belop > 2_147_483_647) {
    return { ok: false, feilmelding: "Beløp må være et positivt heltall." };
  }

  if (!Number.isInteger(input.eiendomId)) {
    return { ok: false, feilmelding: "Fant ikke eiendommen." };
  }
  const eiendom = await prisma.bolig.findUnique({ where: { id: input.eiendomId } });
  if (!eiendom) {
    return { ok: false, feilmelding: "Fant ikke eiendommen." };
  }

  if (!Number.isInteger(input.brukerId)) {
    return { ok: false, feilmelding: "Ugyldig eier." };
  }
  const bruker = await prisma.adminUser.findUnique({ where: { id: input.brukerId } });
  if (!bruker || bruker.rolle !== "eier") {
    return { ok: false, feilmelding: "Ugyldig eier." };
  }

  try {
    const data = await opprettKapitalinnskudd(prisma, {
      eiendomId: input.eiendomId,
      brukerId: input.brukerId,
      dato,
      belop: input.belop,
      beskrivelse: input.beskrivelse,
    });
    return { ok: true, data };
  } catch (err) {
    console.error("Uventet feil ved registrering av kapitalinnskudd:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}

export async function slettInnskuddAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettKapitalinnskudd(prisma, id);
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === KAPITALINNSKUDD_FEIL) {
      return { ok: false, feilmelding: KAPITALINNSKUDD_FEIL };
    }
    console.error("Uventet feil ved sletting av kapitalinnskudd:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
