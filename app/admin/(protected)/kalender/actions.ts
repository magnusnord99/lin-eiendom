"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  erGyldigTilgjengelighetStatus,
  validerKlStartSlutt,
  MAKS_GJENTAKELSER,
  settTilgjengelighet,
  slettTilgjengelighet,
  TILGJENGELIGHET_EIER_FEIL,
} from "@/lib/tilgjengelighet";
import {
  opprettArbeidshendelse,
  slettArbeidshendelse,
  ARBEIDSHENDELSE_FEIL,
} from "@/lib/arbeidshendelse";

export type HandlingResultat<T> = { ok: true; data: T } | { ok: false; feilmelding: string };

export async function settTilgjengelighetAction(input: {
  dato: string;
  status: string;
  fraKl?: string;
  tilKl?: string;
  gjentaUkerAntall?: number;
}): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  if (typeof input.dato !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dato)) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }
  const dato = new Date(`${input.dato}T00:00:00.000Z`);
  if (Number.isNaN(dato.getTime()) || dato.toISOString().slice(0, 10) !== input.dato) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }

  if (!erGyldigTilgjengelighetStatus(input.status)) {
    return { ok: false, feilmelding: "Ugyldig status." };
  }

  const klFeil = validerKlStartSlutt(input.fraKl, input.tilKl);
  if (klFeil) {
    return { ok: false, feilmelding: klFeil };
  }

  if (input.gjentaUkerAntall !== undefined) {
    if (
      !Number.isInteger(input.gjentaUkerAntall) ||
      input.gjentaUkerAntall < 1 ||
      input.gjentaUkerAntall > MAKS_GJENTAKELSER
    ) {
      return {
        ok: false,
        feilmelding: `Antall gjentakelser må være mellom 1 og ${MAKS_GJENTAKELSER} uker.`,
      };
    }
  }

  await settTilgjengelighet(prisma, {
    brukerId: Number(session.user.id),
    dato,
    status: input.status,
    fraKl: input.fraKl,
    tilKl: input.tilKl,
    gjentaUkerAntall: input.gjentaUkerAntall,
  });

  revalidatePath("/admin/kalender");
  return { ok: true, data: null };
}

export async function slettTilgjengelighetAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettTilgjengelighet(prisma, id, Number(session.user.id));
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === TILGJENGELIGHET_EIER_FEIL) {
      return { ok: false, feilmelding: TILGJENGELIGHET_EIER_FEIL };
    }
    console.error("Uventet feil ved sletting av tilgjengelighet:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}

export async function opprettArbeidshendelseAction(input: {
  eiendomId: number;
  tittel: string;
  beskrivelse?: string;
  dato: string;
  fraKl?: string;
  tilKl?: string;
}): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  if (typeof input.dato !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.dato)) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }
  const dato = new Date(`${input.dato}T00:00:00.000Z`);
  if (Number.isNaN(dato.getTime()) || dato.toISOString().slice(0, 10) !== input.dato) {
    return { ok: false, feilmelding: "Ugyldig dato." };
  }

  if (!input.tittel || !input.tittel.trim()) {
    return { ok: false, feilmelding: "Tittel er påkrevd." };
  }

  const klFeil = validerKlStartSlutt(input.fraKl, input.tilKl);
  if (klFeil) {
    return { ok: false, feilmelding: klFeil };
  }

  if (!Number.isInteger(input.eiendomId)) {
    return { ok: false, feilmelding: "Fant ikke eiendommen." };
  }
  const eiendom = await prisma.bolig.findUnique({ where: { id: input.eiendomId } });
  if (!eiendom) {
    return { ok: false, feilmelding: "Fant ikke eiendommen." };
  }

  try {
    await opprettArbeidshendelse(prisma, {
      eiendomId: input.eiendomId,
      tittel: input.tittel,
      beskrivelse: input.beskrivelse,
      dato,
      fraKl: input.fraKl,
      tilKl: input.tilKl,
      opprettetAvBrukerId: Number(session.user.id),
    });
    revalidatePath("/admin/kalender");
    return { ok: true, data: null };
  } catch (err) {
    console.error("Uventet feil ved registrering av arbeidshendelse:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}

export async function slettArbeidshendelseAction(id: number): Promise<HandlingResultat<null>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Ikke autorisert.");

  try {
    await slettArbeidshendelse(prisma, id);
    return { ok: true, data: null };
  } catch (err) {
    if (err instanceof Error && err.message === ARBEIDSHENDELSE_FEIL) {
      return { ok: false, feilmelding: ARBEIDSHENDELSE_FEIL };
    }
    console.error("Uventet feil ved sletting av arbeidshendelse:", err);
    return { ok: false, feilmelding: "Noe gikk galt. Prøv igjen." };
  }
}
