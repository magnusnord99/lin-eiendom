"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { opprettDelprosjekt } from "@/lib/delprosjekt";
import type { Timeregistrering } from "@/app/generated/prisma/client";
import {
  opprettTimeregistrering,
  slettTimeregistrering,
  TIMEREGISTRERING_EIER_FEIL,
} from "@/lib/timeregistrering";

export async function opprettDelprosjektAction(input: { eiendomId: number; navn: string; beskrivelse?: string; budsjett?: number }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");
  if (!input.navn.trim()) throw new Error("Navn er påkrevd.");
  if (input.budsjett !== undefined && input.budsjett < 0) throw new Error("Budsjett kan ikke være negativt.");
  return opprettDelprosjekt(prisma, input);
}

export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function registrerTimerAction(input: {
  eiendomId: number;
  delprosjektId: number;
  dato: string;
  antallTimer: number;
  beskrivelse?: string;
}): Promise<HandlingResultat<Timeregistrering>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  if (typeof input.dato !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dato)) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }
  const dato = new Date(`${input.dato}T00:00:00.000Z`);
  if (Number.isNaN(dato.getTime()) || dato.toISOString().slice(0, 10) !== input.dato) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }

  if (!Number.isFinite(input.antallTimer) || input.antallTimer <= 0 || input.antallTimer > 24) {
    return { ok: false, feilmelding: "Antall timer må være mer enn 0 og høyst 24." };
  }

  if (!Number.isInteger(input.delprosjektId)) {
    return { ok: false, feilmelding: "Delprosjektet finnes ikke på denne eiendommen." };
  }

  const delprosjekt = await prisma.delprosjekt.findUnique({ where: { id: input.delprosjektId } });
  if (!delprosjekt || delprosjekt.eiendomId !== input.eiendomId) {
    return { ok: false, feilmelding: "Delprosjektet finnes ikke på denne eiendommen." };
  }

  const data = await opprettTimeregistrering(prisma, {
    delprosjektId: input.delprosjektId,
    brukerId: Number(session.user.id),
    dato,
    antallTimer: input.antallTimer,
    beskrivelse: input.beskrivelse,
  });
  return { ok: true, data };
}

export async function slettTimeregistreringAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettTimeregistrering(prisma, id, Number(session.user.id));
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === TIMEREGISTRERING_EIER_FEIL) {
      return { ok: false, feilmelding: TIMEREGISTRERING_EIER_FEIL };
    }
    console.error("Uventet feil ved sletting av timeregistrering:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
