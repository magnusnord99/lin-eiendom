import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bolig = await prisma.bolig.findUnique({ where: { id: parseInt(id) } });
  if (!bolig) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });
  return NextResponse.json(bolig);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();
  const bolig = await prisma.bolig.update({ where: { id: parseInt(id) }, data });
  return NextResponse.json(bolig);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  await prisma.bolig.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
