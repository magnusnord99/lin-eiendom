import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BoligKort from "@/components/BoligKort";
import { Home, Key, ClipboardList, MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const boliger = await prisma.bolig.findMany({
    where: { aktiv: true },
    orderBy: { opprettet: "desc" },
    take: 6,
  });

  const salgBoliger = boliger.filter((b) => b.type === "salg").slice(0, 3);
  const leieBoliger = boliger.filter((b) => b.type === "leie").slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--primary)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-white/60 text-sm font-medium uppercase tracking-widest mb-4">
              Profesjonell eiendomsmegling
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
              Finn din neste{" "}
              <span className="text-blue-300">drømmebolig</span>
            </h1>
            <p className="text-white/80 text-lg leading-relaxed mb-10">
              LIN Eiendom hjelper deg med å kjøpe eller leie bolig. Vi kombinerer lokal
              kunnskap med personlig service for å finne det som passer deg best.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/salg"
                className="bg-white text-[var(--primary)] px-6 py-3 rounded-md font-semibold hover:bg-blue-50 transition-colors"
              >
                Boliger til salgs
              </Link>
              <Link
                href="/leie"
                className="border border-white/40 text-white px-6 py-3 rounded-md font-semibold hover:bg-white/10 transition-colors"
              >
                Boliger til leie
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { tall: "200+", label: "Solgte boliger" },
              { tall: "150+", label: "Utleieboliger" },
              { tall: "15 år", label: "Erfaring" },
              { tall: "98%", label: "Fornøyde kunder" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-[var(--primary)]">{stat.tall}</p>
                <p className="text-[var(--muted)] text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Boliger til salgs */}
      {salgBoliger.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Boliger til salgs</h2>
              <p className="text-[var(--muted)] text-sm mt-1">Utvalgte eiendommer</p>
            </div>
            <Link href="/salg" className="text-[var(--primary)] text-sm font-medium hover:underline">
              Se alle →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {salgBoliger.map((bolig) => (
              <BoligKort key={bolig.id} {...bolig} />
            ))}
          </div>
        </section>
      )}

      {/* Boliger til leie */}
      {leieBoliger.length > 0 && (
        <section className="bg-[var(--surface)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Boliger til leie</h2>
                <p className="text-[var(--muted)] text-sm mt-1">Ledige utleieboliger</p>
              </div>
              <Link href="/leie" className="text-[var(--primary)] text-sm font-medium hover:underline">
                Se alle →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leieBoliger.map((bolig) => (
                <BoligKort key={bolig.id} {...bolig} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Om oss snippet */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[var(--secondary)] text-sm font-medium uppercase tracking-widest mb-3">
              Om LIN Eiendom
            </p>
            <h2 className="text-3xl font-bold text-[var(--foreground)] mb-5">
              Vi kjenner markedet – og vi kjenner deg
            </h2>
            <p className="text-[var(--muted)] leading-relaxed mb-6">
              Med over 15 års erfaring i eiendomsbransjen har LIN Eiendom hjulpet hundrevis
              av kunder med å finne sin drømmebolig. Vi fokuserer på ærlighet, transparens
              og din trygghet gjennom hele prosessen.
            </p>
            <Link
              href="/om-oss"
              className="inline-flex items-center gap-2 text-[var(--primary)] font-medium hover:gap-3 transition-all"
            >
              Les mer om oss →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Home, tittel: "Salg", tekst: "Profesjonell hjelp gjennom hele salgsprosessen" },
              { icon: Key, tittel: "Utleie", tekst: "Trygg og enkel utleie for leietaker og utleier" },
              { icon: ClipboardList, tittel: "Verdivurdering", tekst: "Gratis og uforpliktende verdivurdering" },
              { icon: MessageSquare, tittel: "Rådgivning", tekst: "Personlig rådgivning tilpasset dine behov" },
            ].map((item) => (
              <div key={item.tittel} className="bg-[var(--surface)] rounded-xl p-5 border border-[var(--border)]">
                <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center mb-3">
                  <item.icon className="w-5 h-5 text-[var(--primary)]" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-sm text-[var(--foreground)] mb-1">{item.tittel}</h3>
                <p className="text-[var(--muted)] text-xs leading-relaxed">{item.tekst}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">
            Klar for neste steg?
          </h2>
          <p className="text-[var(--muted)] mb-8 max-w-md mx-auto">
            Ta kontakt med oss i dag for en uforpliktende samtale om dine boligbehov.
          </p>
          <Link
            href="/kontakt"
            className="bg-[var(--primary)] text-white px-8 py-3 rounded-md font-semibold hover:bg-[var(--primary-light)] transition-colors"
          >
            Kom i kontakt
          </Link>
        </div>
      </section>
    </>
  );
}
