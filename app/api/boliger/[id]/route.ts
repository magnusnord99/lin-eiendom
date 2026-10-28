import { NextRequest, NextResponse } from "next/server";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { hentOffentligSynligBolig, plukkSkrivbareBoligFelter, validerBoligPengefelt } from "@/lib/eiendom";
import { resolverEffektivStatus, validerStatusForSkriving } from "@/lib/eiendom-status";
import { harDelprosjekter } from "@/lib/delprosjekt";
import { harKapitalinnskudd } from "@/lib/kapitalinnskudd";
import { harUtgifter } from "@/lib/utgift";
import { harDokumenter } from "@/lib/dokument";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bolig = await hentOffentligSynligBolig(prisma, parseInt(id));
  if (!bolig) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  return NextResponse.json(bolig);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseInt(idParam);
  // forventetStatus/forventetType er det klienten opprinnelig lastet (ikke Bolig-kolonner).
  const { forventetStatus, forventetType, ...raw } = await req.json();
  const data = plukkSkrivbareBoligFelter(raw);

  const pengefeil = validerBoligPengefelt(data);
  if (pengefeil) return NextResponse.json({ error: pengefeil }, { status: 400 });

  const eksisterende = await prisma.bolig.findUnique({ where: { id } });
  if (!eksisterende) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  if (data.status === undefined && data.type === undefined) {
    // Ingen status/type i forespørselen: ingen samtidighetsrisiko for disse feltene.
    const bolig = await prisma.bolig.update({ where: { id }, data: data as Prisma.BoligUpdateInput });
    return NextResponse.json(bolig);
  }

  let feil: string | null;
  try {
    const { status, type } = resolverEffektivStatus(data, eksisterende);
    feil = validerStatusForSkriving(status, type);
    data.status = status;
    data.type = type;
  } catch {
    feil = "Mangler type.";
  }
  if (feil) return NextResponse.json({ error: feil }, { status: 400 });

  // Optimistisk samtidighetskontroll: skriv kun hvis raden fortsatt har den
  // statusen/typen klienten lastet (forventet*), så et utdatert skjema ikke stille
  // overskriver en samtidig endring. Faller tilbake til den ferske lesingen for
  // kallere som ikke sender forventet* (svakere vern, men bryter ikke).
  const resultat = await prisma.bolig.updateMany({
    where: {
      id,
      status: typeof forventetStatus === "string" ? forventetStatus : eksisterende.status,
      type: typeof forventetType === "string" ? forventetType : eksisterende.type,
    },
    data: data as Prisma.BoligUpdateInput,
  });
  if (resultat.count === 0) {
    return NextResponse.json(
      { error: "Eiendommen ble endret av en annen i mellomtiden. Last siden på nytt og prøv igjen." },
      { status: 409 }
    );
  }

  const bolig = await prisma.bolig.findUnique({ where: { id } });
  return NextResponse.json(bolig);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const eiendomId = parseInt(id);

  // Rask vei: sjekk først om det finnes delprosjekter, så vi normalt kan
  // returnere en forklarlig 409 uten å gå via databasefeilen.
  if (await harDelprosjekter(prisma, eiendomId)) {
    return NextResponse.json(
      { error: "Kan ikke slette en eiendom med registrerte delprosjekter." },
      { status: 409 }
    );
  }

  if (await harKapitalinnskudd(prisma, eiendomId)) {
    return NextResponse.json(
      { error: "Kan ikke slette en eiendom med registrerte kapitalinnskudd." },
      { status: 409 }
    );
  }

  if (await harUtgifter(prisma, eiendomId)) {
    return NextResponse.json(
      { error: "Kan ikke slette en eiendom med registrerte utgifter." },
      { status: 409 }
    );
  }

  if (await harDokumenter(prisma, eiendomId)) {
    return NextResponse.json(
      { error: "Kan ikke slette en eiendom med registrerte dokumenter." },
      { status: 409 }
    );
  }

  try {
    await prisma.bolig.delete({ where: { id: eiendomId } });
  } catch (error) {
    // Kappløp: et delprosjekt, kapitalinnskudd, utgift eller dokument kan ha blitt
    // opprettet mellom sjekkene over og selve slettingen. Fang fremmednøkkel-feilen og
    // svar med en generisk 409, i stedet for en ukontrollert 500. Vi vet her ikke hvilken
    // av de fire fremmednøklene som faktisk slo til.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Kan ikke slette en eiendom med registrerte delprosjekter, kapitalinnskudd, utgifter eller dokumenter.",
        },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
