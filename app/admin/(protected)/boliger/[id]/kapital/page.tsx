import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hentInnskuddForEiendom, beregnEierandeler } from "@/lib/kapitalinnskudd";
import KapitalPanel from "./KapitalPanel";

export const dynamic = "force-dynamic";

export default async function KapitalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eiendomId = parseInt(id);

  const eiendom = await prisma.bolig.findUnique({ where: { id: eiendomId } });

  if (!eiendom) notFound();

  const eiere = await prisma.adminUser.findMany({ where: { rolle: "eier" }, orderBy: { navn: "asc" } });
  const innskuddRader = await hentInnskuddForEiendom(prisma, eiendomId);
  const innskudd = innskuddRader.map((rad) => ({
    id: rad.id,
    dato: rad.dato.toISOString().slice(0, 10),
    belop: rad.belop,
    beskrivelse: rad.beskrivelse,
    brukerId: rad.brukerId,
    brukerNavn: rad.brukerNavn,
  }));
  const eierandeler = await beregnEierandeler(prisma, eiendomId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/boliger/${eiendomId}`} className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Kapital – {eiendom.tittel}</h1>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/delprosjekter`} className="text-sm text-[var(--primary)] hover:underline">
          Delprosjekter
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/fortjeneste`} className="text-sm text-[var(--primary)] hover:underline">
          Fortjeneste
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/dokumenter`} className="text-sm text-[var(--primary)] hover:underline">
          Dokumenter
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Eierandeler</h2>
        {eierandeler.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ingen eiere registrert.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {eierandeler.map((rad) => (
              <li key={rad.brukerId} className="py-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--foreground)]">{rad.brukerNavn}</p>
                <p className="text-sm text-[var(--foreground)]">
                  {new Intl.NumberFormat("nb-NO").format(rad.belop)} kr – {rad.andelProsent.toFixed(1)} %
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Kapitalinnskudd</h2>
        <KapitalPanel
          eiendomId={eiendomId}
          eiere={eiere.map((e) => ({ id: e.id, navn: e.navn }))}
          innskudd={innskudd}
        />
      </div>
    </div>
  );
}
