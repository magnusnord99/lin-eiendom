import { prisma } from "@/lib/prisma";
import BoligKort from "@/components/BoligKort";

export const dynamic = "force-dynamic";

export default async function SalgPage() {
  const boliger = await prisma.bolig.findMany({
    where: { aktiv: true, type: "salg" },
    orderBy: { opprettet: "desc" },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-[var(--foreground)] mb-2">Boliger til salgs</h1>
        <p className="text-[var(--muted)]">{boliger.length} eiendommer tilgjengelig</p>
      </div>

      {boliger.length === 0 ? (
        <div className="text-center py-24 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Ingen boliger ute for salg</h2>
          <p className="text-[var(--muted)]">Sjekk tilbake snart for nye annonser.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boliger.map((bolig) => (
            <BoligKort key={bolig.id} {...bolig} />
          ))}
        </div>
      )}
    </div>
  );
}
