import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NyttDelprosjektSkjema from "./NyttDelprosjektSkjema";

export const dynamic = "force-dynamic";

export default async function DelprosjekterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eiendomId = parseInt(id);

  const eiendom = await prisma.bolig.findUnique({
    where: { id: eiendomId },
    include: { delprosjekter: { orderBy: { opprettet: "desc" } } },
  });

  if (!eiendom) notFound();

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/boliger/${eiendomId}`} className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Delprosjekter – {eiendom.tittel}</h1>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Nytt delprosjekt</h2>
        <NyttDelprosjektSkjema eiendomId={eiendomId} />
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Eksisterende delprosjekter</h2>
        {eiendom.delprosjekter.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ingen delprosjekter registrert.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {eiendom.delprosjekter.map((d) => (
              <li key={d.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{d.navn}</p>
                  <p className="text-xs text-[var(--muted)]">{d.status}</p>
                </div>
                <p className="text-sm text-[var(--foreground)]">
                  {d.budsjett != null ? new Intl.NumberFormat("nb-NO").format(d.budsjett) + " kr" : "–"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
