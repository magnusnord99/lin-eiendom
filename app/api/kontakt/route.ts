import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { navn, epost, telefon, melding, boligId } = await req.json();

  if (!navn || !epost || !melding) {
    return NextResponse.json({ error: "Fyll ut alle påkrevde felt" }, { status: 400 });
  }

  // I produksjon: send epost via nodemailer/sendgrid
  console.log("Kontaktskjema mottatt:", { navn, epost, telefon, melding, boligId });

  return NextResponse.json({ ok: true, melding: "Takk! Vi tar kontakt snart." });
}
