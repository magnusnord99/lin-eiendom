import { prisma } from "@/lib/prisma";
import BoligKort from "@/components/BoligKort";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BoligerPage() {
  const boliger = await prisma.bolig.findMany({
    where: { aktiv: true },
    orderBy: { opprettet: "desc" },
  });

  const salgBoliger = boliger.filter((b) => b.type === "salg");
  const leieBoliger = boliger.filter((b) => b.type === "leie");

  return (
    <div>
      {/* Header */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Boliger</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-3">Våre boliger</h1>
          <p className="text-[var(--muted)]">
            Ferdig renoverte boliger til salgs og til leie.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* Til salgs */}
        {salgBoliger.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-1">Salg</p>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Til salgs</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {salgBoliger.map((bolig) => (
                <BoligKort key={bolig.id} {...bolig} />
              ))}
            </div>
          </section>
        )}

        {/* Til leie */}
        {leieBoliger.length > 0 && (
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-1">Leie</p>
                <h2 className="text-xl font-bold text-[var(--foreground)]">Til leie</h2>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leieBoliger.map((bolig) => (
                <BoligKort key={bolig.id} {...bolig} />
              ))}
            </div>
          </section>
        )}

        {boliger.length === 0 && (
          <div className="text-center py-20">
            <p className="text-[var(--muted)] text-lg mb-2">Ingen boliger tilgjengelig akkurat nå.</p>
            <p className="text-[var(--muted)] text-sm mb-8">Sjekk tilbake snart — vi renoverer jevnlig nye objekter.</p>
            <Link
              href="/selg-til-oss"
              className="inline-block bg-[var(--primary)] text-white px-6 py-3 rounded-md font-semibold text-sm hover:bg-[var(--primary-light)] transition-colors"
            >
              Vil du selge til oss?
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
