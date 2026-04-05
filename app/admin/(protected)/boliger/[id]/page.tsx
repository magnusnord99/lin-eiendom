import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BoligSkjema from "@/components/admin/BoligSkjema";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RedigerBoligPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bolig = await prisma.bolig.findUnique({ where: { id: parseInt(id) } });

  if (!bolig) notFound();

  let bilder: string[] = [];
  try { bilder = JSON.parse(bolig.bilder); } catch {}

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/boliger" className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Rediger bolig</h1>
      </div>
      <BoligSkjema
        initial={{
          id: bolig.id,
          tittel: bolig.tittel,
          adresse: bolig.adresse,
          by: bolig.by,
          pris: bolig.pris?.toString() ?? "",
          type: bolig.type,
          storrelse: bolig.storrelse?.toString() ?? "",
          rom: bolig.rom?.toString() ?? "",
          bad: bolig.bad?.toString() ?? "",
          beskrivelse: bolig.beskrivelse,
          bilder,
          lat: bolig.lat?.toString() ?? "",
          lng: bolig.lng?.toString() ?? "",
          aktiv: bolig.aktiv,
        }}
      />
    </div>
  );
}
