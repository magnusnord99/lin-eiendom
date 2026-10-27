import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hentDokumenterForEiendom } from "@/lib/dokument";
import DokumentPanel from "./DokumentPanel";

export const dynamic = "force-dynamic";

export default async function DokumenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eiendomId = parseInt(id);

  const eiendom = await prisma.bolig.findUnique({
    where: { id: eiendomId },
    include: { delprosjekter: { orderBy: { opprettet: "desc" } } },
  });

  if (!eiendom) notFound();

  const dokumentRader = await hentDokumenterForEiendom(prisma, eiendomId);
  const dokumenter = dokumentRader.map((d) => ({
    id: d.id,
    kategori: d.kategori,
    navn: d.navn,
    mimeType: d.mimeType,
    storrelse: d.storrelse,
    opprettet: d.opprettet.toISOString().slice(0, 10),
    delprosjektId: d.delprosjektId,
    delprosjektNavn: d.delprosjektNavn,
    opplastetAvBrukerId: d.opplastetAvBrukerId,
    opplastetAvNavn: d.opplastetAvNavn,
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/boliger/${eiendomId}`} className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dokumenter – {eiendom.tittel}</h1>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/delprosjekter`} className="text-sm text-[var(--primary)] hover:underline">
          Delprosjekter
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/kapital`} className="text-sm text-[var(--primary)] hover:underline">
          Kapital
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/fortjeneste`} className="text-sm text-[var(--primary)] hover:underline">
          Fortjeneste
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Dokumenter</h2>
        <DokumentPanel
          eiendomId={eiendomId}
          delprosjekter={eiendom.delprosjekter.map((d) => ({ id: d.id, navn: d.navn }))}
          dokumenter={dokumenter}
        />
      </div>
    </div>
  );
}
