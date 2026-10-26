import { NextRequest, NextResponse } from "next/server";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { hentOffentligSynligeBoliger, plukkSkrivbareBoligFelter } from "@/lib/eiendom";
import { resolverEffektivStatus, validerStatusForSkriving } from "@/lib/eiendom-status";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const boliger = await hentOffentligSynligeBoliger(prisma, {
    type: searchParams.get("type") ?? undefined,
    by: searchParams.get("by") ?? undefined,
  });

  return NextResponse.json(boliger);
}

export async function POST(req: NextRequest) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const data = plukkSkrivbareBoligFelter(await req.json());

  let effektiv: { status: unknown; type: string };
  try {
    effektiv = resolverEffektivStatus(data);
  } catch {
    return NextResponse.json({ error: "Mangler type." }, { status: 400 });
  }
  const feil = validerStatusForSkriving(effektiv.status, effektiv.type);
  if (feil) return NextResponse.json({ error: feil }, { status: 400 });
  data.status = effektiv.status;
  data.type = effektiv.type;

  const bolig = await prisma.bolig.create({ data: data as unknown as Prisma.BoligCreateInput });
  return NextResponse.json(bolig, { status: 201 });
}
