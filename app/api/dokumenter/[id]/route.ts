import { NextRequest, NextResponse } from "next/server";
import { del, get } from "@vercel/blob";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DOKUMENT_FEIL, hentDokumentForNedlasting, slettDokumentRad } from "@/lib/dokument";

const DOKUMENT_SLETTEFEIL = "Kunne ikke slette dokumentet fra lagring. Prøv igjen.";

// Bygger en RFC 5987/6266-sikker Content-Disposition-header. Rå header-verdier er
// begrenset til ByteString (Latin-1), så et filnavn med f.eks. en tankestrek eller
// anførselstegn må ikke settes rått i `filename="..."` — det ville kastet når
// Headers/Response bygges. Vi fjerner kontrolltegn helt, lager en ASCII-only
// fallback for `filename=`, og en prosent-kodet UTF-8-variant for `filename*=`.
// `encodeURIComponent` alene er ikke RFC 5987-sikkert (den lar `'`, `(`, `)` og `*`
// stå urørt), så vi legger på en ekstra kodings-runde for de fire tegnene.
export function contentDisposition(navn: string): string {
  // Fjerner kontrolltegn (C0 + DEL) helt, med vilje.
  const utenKontrolltegn = navn.replace(/[\x00-\x1F\x7F]/g, "");
  const asciiVariant = utenKontrolltegn.replace(/[^\x20-\x7E]|["\\]/g, "_");
  const rfc5987Kodet = encodeURIComponent(utenKontrolltegn).replace(
    /['()*]/g,
    (tegn) => "%" + tegn.charCodeAt(0).toString(16).toUpperCase()
  );

  return `attachment; filename="${asciiVariant}"; filename*=UTF-8''${rfc5987Kodet}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const parsedId = parseInt(id, 10);
  if (!Number.isInteger(parsedId)) return NextResponse.json({ error: "Ugyldig id." }, { status: 400 });

  const dokument = await hentDokumentForNedlasting(prisma, parsedId);
  if (!dokument) return NextResponse.json({ error: DOKUMENT_FEIL }, { status: 404 });

  const resultat = await get(dokument.blobPathname, { access: "private" });
  if (!resultat) {
    // DB-raden og Blob-objektet har kommet ut av synk; behandle det som manglende,
    // ikke en ukontrollert feil.
    return NextResponse.json({ error: DOKUMENT_FEIL }, { status: 404 });
  }

  return new NextResponse(resultat.stream, {
    headers: {
      "Content-Type": dokument.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(dokument.navn),
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const { id } = await params;
  const parsedId = parseInt(id, 10);
  if (!Number.isInteger(parsedId)) return NextResponse.json({ error: "Ugyldig id." }, { status: 400 });

  const dokument = await hentDokumentForNedlasting(prisma, parsedId);
  if (!dokument) return NextResponse.json({ error: DOKUMENT_FEIL }, { status: 404 });

  // Slettingsrekkefølgen er bindende: Blob-objektet må være bekreftet slettet
  // FØR DB-raden slettes. Hvis Blob-slettingen feiler, avbryter vi helt — da er
  // det bedre å ha en DB-rad som peker på et levende objekt enn et Blob-objekt
  // som ingen DB-rad peker på (et lekket objekt er usynlig og kan ikke ryddes).
  try {
    await del(dokument.blobPathname);
  } catch (error) {
    console.error("Kunne ikke slette Blob-objekt:", dokument.blobPathname, error);
    return NextResponse.json({ error: DOKUMENT_SLETTEFEIL }, { status: 502 });
  }

  await slettDokumentRad(prisma, parsedId);

  return NextResponse.json({ ok: true });
}
