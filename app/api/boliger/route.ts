import { NextRequest, NextResponse } from "next/server";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const by = searchParams.get("by");

  const boliger = await prisma.bolig.findMany({
    where: {
      aktiv: true,
      ...(type ? { type } : {}),
      ...(by ? { by: { contains: by } } : {}),
    },
    orderBy: { opprettet: "desc" },
  });

  return NextResponse.json(boliger);
}

export async function POST(req: NextRequest) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const data = await req.json();
  const bolig = await prisma.bolig.create({ data });
  return NextResponse.json(bolig, { status: 201 });
}
