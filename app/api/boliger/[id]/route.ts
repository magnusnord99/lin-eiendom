import { NextRequest, NextResponse } from "next/server";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hentOffentligSynligBolig } from "@/lib/eiendom";
import { resolverEffektivStatus, validerStatusForSkriving } from "@/lib/eiendom-status";

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
  const { forventetStatus, forventetType, ...data } = await req.json();

  const eksisterende = await prisma.bolig.findUnique({ where: { id } });
  if (!eksisterende) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  if (data.status === undefined && data.type === undefined) {
    // Ingen status/type i forespørselen: ingen samtidighetsrisiko for disse feltene.
    const bolig = await prisma.bolig.update({ where: { id }, data });
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
    data,
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
  await prisma.bolig.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
