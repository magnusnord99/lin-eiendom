import { NextRequest, NextResponse } from "next/server";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hentKvittering, lagreKvittering, UTGIFT_FEIL, UTGIFT_KVITTERING_FOR_STOR, UTGIFT_KVITTERING_UGYLDIG_FORMAT } from "@/lib/utgift";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const parsedId = parseInt(id);
  if (!Number.isInteger(parsedId)) return NextResponse.json({ error: "Ugyldig id." }, { status: 400 });

  const kvittering = await hentKvittering(prisma, parsedId);
  if (!kvittering) return NextResponse.json({ error: UTGIFT_FEIL }, { status: 404 });

  return new NextResponse(new Uint8Array(kvittering.bytes), {
    headers: {
      "Content-Type": kvittering.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const parsedId = parseInt(id);
  if (!Number.isInteger(parsedId)) return NextResponse.json({ error: "Ugyldig id." }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Ingen fil" }, { status: 400 });

  if (file.size > 4_000_000) {
    return NextResponse.json({ error: UTGIFT_KVITTERING_FOR_STOR }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await lagreKvittering(prisma, parsedId, bytes);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === UTGIFT_KVITTERING_FOR_STOR) {
      return NextResponse.json({ error: UTGIFT_KVITTERING_FOR_STOR }, { status: 413 });
    }
    if (err instanceof Error && err.message === UTGIFT_KVITTERING_UGYLDIG_FORMAT) {
      return NextResponse.json({ error: UTGIFT_KVITTERING_UGYLDIG_FORMAT }, { status: 400 });
    }
    if (err instanceof Error && err.message === UTGIFT_FEIL) {
      return NextResponse.json({ error: UTGIFT_FEIL }, { status: 404 });
    }
    throw err;
  }
}
