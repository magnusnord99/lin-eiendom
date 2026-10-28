import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { krevInnloggetSesjon } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { erGyldigDokumentKategori, hentDelprosjektEiendomId, opprettDokument } from "@/lib/dokument";

const DOKUMENT_FOR_STOR = "Dokumentet er for stort (maks 4 MB).";
const DOKUMENT_UGYLDIG_FORMAT = "Ugyldig filformat. Kun PDF, JPEG, PNG, WebP og GIF er støttet.";
const DOKUMENT_LAGRINGSFEIL = "Kunne ikke lagre dokumentet. Prøv igjen.";

// Byte-signatur-deteksjon, samme teknikk som `detekterBildeformat` i lib/utgift.ts
// (kopiert lokalt, siden lib/dokument.ts er eksplisitt lagringsagnostisk og denne
// valideringen hører til route-laget, ikke metadata-laget), utvidet med PDF.
export function detekterDokumentformat(bytes: Buffer): string | null {
  if (startsWithAscii(bytes, "%PDF-", 0)) {
    return "application/pdf";
  }

  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (startsWithAscii(bytes, "GIF87a", 0) || startsWithAscii(bytes, "GIF89a", 0)) {
    return "image/gif";
  }

  if (startsWithAscii(bytes, "RIFF", 0) && startsWithAscii(bytes, "WEBP", 8)) {
    return "image/webp";
  }

  return null;
}

function startsWithBytes(bytes: Buffer, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) return false;
  }
  return true;
}

function startsWithAscii(bytes: Buffer, ascii: string, offset: number): boolean {
  if (bytes.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

// Fjern alt som ikke er alfanumerisk, ".", "-" eller "_", så Blob-pathnamen
// alltid er velformet uansett hva en nettleser sender som filnavn.
function sanitizerNavnForPathname(navn: string): string {
  return navn.replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(req: NextRequest) {
  const bruker = await krevInnloggetSesjon();
  if (!bruker) return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });

  const formData = await req.formData();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil valgt." }, { status: 400 });
  }

  const eiendomIdRaw = formData.get("eiendomId");
  const eiendomId = typeof eiendomIdRaw === "string" ? parseInt(eiendomIdRaw, 10) : NaN;
  if (!Number.isInteger(eiendomId)) {
    return NextResponse.json({ error: "Ugyldig eiendomId." }, { status: 400 });
  }

  const kategori = formData.get("kategori");

  const delprosjektIdRaw = formData.get("delprosjektId");
  let delprosjektId: number | undefined;
  if (typeof delprosjektIdRaw === "string" && delprosjektIdRaw !== "") {
    delprosjektId = parseInt(delprosjektIdRaw, 10);
    if (!Number.isInteger(delprosjektId)) {
      return NextResponse.json({ error: "Ugyldig delprosjektId." }, { status: 400 });
    }
  }

  const navnRaw = formData.get("navn");
  const navn = typeof navnRaw === "string" && navnRaw !== "" ? navnRaw : file.name;

  // Steg 3: størrelse, før vi i det hele tatt leser filinnholdet.
  if (file.size > 4_000_000) {
    return NextResponse.json({ error: DOKUMENT_FOR_STOR }, { status: 413 });
  }

  // Steg 4: filformat (byte-signatur).
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = detekterDokumentformat(bytes);
  if (mimeType == null) {
    return NextResponse.json({ error: DOKUMENT_UGYLDIG_FORMAT }, { status: 400 });
  }

  // Steg 5: kategori.
  if (!erGyldigDokumentKategori(kategori)) {
    return NextResponse.json({ error: "Ugyldig kategori." }, { status: 400 });
  }

  // Steg 6: eiendomId må peke på en reell Bolig.
  const bolig = await prisma.bolig.findUnique({ where: { id: eiendomId } });
  if (!bolig) {
    return NextResponse.json({ error: "Fant ikke eiendommen." }, { status: 404 });
  }

  // Steg 7: hvis delprosjektId er angitt, må det tilhøre den samme eiendommen.
  if (delprosjektId !== undefined) {
    const delprosjektEiendomId = await hentDelprosjektEiendomId(prisma, delprosjektId);
    if (delprosjektEiendomId == null || delprosjektEiendomId !== eiendomId) {
      return NextResponse.json({ error: "Delprosjektet tilhører ikke den angitte eiendommen." }, { status: 400 });
    }
  }

  const pathname = `dokumenter/eiendom-${eiendomId}/${Date.now()}-${sanitizerNavnForPathname(navn)}`;

  const putResultat = await put(pathname, bytes, { access: "private", contentType: mimeType });

  try {
    const dokument = await opprettDokument(prisma, {
      eiendomId,
      delprosjektId,
      kategori,
      navn,
      blobPathname: putResultat.pathname,
      mimeType,
      storrelse: file.size,
      opplastetAvBrukerId: parseInt(bruker.id, 10),
    });

    return NextResponse.json({ id: dokument.id }, { status: 201 });
  } catch (error) {
    // Kappløp: Bolig/Delprosjekt kan ha blitt slettet mellom eksistens-sjekkene
    // over og innsettingen, slik at fremmednøkkelen feiler. Fjern det nå
    // foreldreløse Blob-objektet før vi svarer med en feil.
    try {
      await del(putResultat.pathname);
    } catch (delError) {
      console.error("Kunne ikke rydde opp foreldreløst Blob-objekt:", putResultat.pathname, delError);
    }

    console.error("Feil ved lagring av dokument:", error);
    return NextResponse.json({ error: DOKUMENT_LAGRINGSFEIL }, { status: 500 });
  }
}
