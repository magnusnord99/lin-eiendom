import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const { navn, epost, telefon, melding, boligId } = await req.json();

  if (!navn || !epost || !melding) {
    return NextResponse.json({ error: "Fyll ut alle påkrevde felt" }, { status: 400 });
  }

  // Trekk ut adresse og tilstand fra melding (SELG TIL OSS-format)
  let adresse: string | undefined;
  let tilstand: string | undefined;
  const adresseMatch = melding.match(/Adresse på objekt: (.+)/);
  const tilstandMatch = melding.match(/Tilstand: (.+)/);
  if (adresseMatch) adresse = adresseMatch[1].trim();
  if (tilstandMatch) tilstand = tilstandMatch[1].trim();

  // Lagre til database
  try {
    await prisma.henvendelse.create({
      data: { navn, epost, telefon: telefon || null, adresse: adresse || null, tilstand: tilstand || null, melding },
    });
  } catch (e) {
    console.error("Feil ved lagring:", e);
  }

  // Send e-post hvis RESEND_API_KEY er satt
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Yappuccino AS <noreply@yappucci.no>",
        to: "post@yappucci.no",
        subject: `Ny henvendelse fra ${navn}`,
        html: `
          <h2>Ny henvendelse via yappucci.no</h2>
          <p><strong>Navn:</strong> ${navn}</p>
          <p><strong>E-post:</strong> ${epost}</p>
          <p><strong>Telefon:</strong> ${telefon || "Ikke oppgitt"}</p>
          ${adresse ? `<p><strong>Adresse på objekt:</strong> ${adresse}</p>` : ""}
          ${tilstand ? `<p><strong>Tilstand:</strong> ${tilstand}</p>` : ""}
          <hr />
          <p><strong>Melding:</strong></p>
          <pre style="white-space:pre-wrap">${melding}</pre>
          <hr />
          <p><a href="https://yappucci.no/admin/henvendelser">Se alle henvendelser i adminpanelet</a></p>
        `,
      });
    } catch (e) {
      console.error("Feil ved e-postsending:", e);
    }
  }

  return NextResponse.json({ ok: true, melding: "Takk! Vi tar kontakt snart." });
}
