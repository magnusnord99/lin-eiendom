import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BoligKort from "@/components/BoligKort";

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
      <section className="relative bg-[var(--primary)] text-white overflow-hidden min-h-[88vh] flex items-center">
        {/* Dot grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        {/* Gradient overlay – bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[var(--primary)] to-transparent" />
        {/* Large decorative number */}
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/[0.04] font-black select-none pointer-events-none leading-none animate-fade-in delay-500"
          style={{ fontSize: "clamp(200px, 28vw, 420px)" }}
        >
          LIN
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36 w-full">
          <p className="animate-slide-right text-white/50 text-xs font-semibold uppercase tracking-[0.25em] mb-6">
            Karl Johns Veg 12 · Profesjonell eiendomsmegling
          </p>
          <h1
            className="animate-fade-up delay-100 font-bold leading-[1.05] mb-8 text-white"
            style={{ fontSize: "clamp(2.8rem, 7vw, 6rem)" }}
          >
            Din neste bolig
            <br />
            <span className="text-blue-300">starter her.</span>
          </h1>
          <p className="animate-fade-up delay-200 text-white/70 text-lg leading-relaxed mb-12 max-w-xl">
            LIN Eiendom hjelper deg med å kjøpe eller leie bolig. Vi kombinerer
            lokal kunnskap med personlig service.
          </p>
          <div className="animate-fade-up delay-300 flex flex-wrap gap-4">
            <Link
              href="/salg"
              className="group bg-white text-[var(--primary)] px-7 py-3.5 rounded-md font-semibold hover:bg-blue-50 transition-all duration-200 flex items-center gap-2"
            >
              Boliger til salgs
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
            <Link
              href="/leie"
              className="group border border-white/30 text-white px-7 py-3.5 rounded-md font-semibold hover:bg-white/10 hover:border-white/50 transition-all duration-200 flex items-center gap-2"
            >
              Boliger til leie
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Marquee stats */}
      <section className="bg-[var(--foreground)] text-white overflow-hidden py-4">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-0 shrink-0">
              {[
                "200+ solgte boliger",
                "150+ utleieboliger",
                "15 års erfaring",
                "98% fornøyde kunder",
                "Karl Johns Veg 12",
                "Alltid tilgjengelig",
              ].map((item) => (
                <span key={item} className="flex items-center gap-6 px-8 text-sm font-medium tracking-wide">
                  <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Tjenester – renset, uten ikoner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">
              Hva vi tilbyr
            </p>
            <h2
              className="font-bold text-[var(--foreground)] leading-tight mb-6"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
            >
              Full service,
              <br />
              fra start til nøkkel.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed text-base max-w-md">
              Vi håndterer hele prosessen for deg – enten du selger, kjøper eller
              ønsker hjelp med utleie.
            </p>
            <Link
              href="/om-oss"
              className="mt-8 inline-flex items-center gap-2 text-[var(--primary)] font-semibold text-sm group"
            >
              <span>Møt teamet vårt</span>
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {[
              { nr: "01", tittel: "Boligsalg", tekst: "Profesjonell gjennomføring fra verdivurdering til overtakelse." },
              { nr: "02", tittel: "Utleie", tekst: "Trygg utleie med grundig screening av leietakere." },
              { nr: "03", tittel: "Verdivurdering", tekst: "Gratis og uforpliktende vurdering av din bolig." },
              { nr: "04", tittel: "Rådgivning", tekst: "Personlig råd tilpasset din situasjon og dine mål." },
            ].map((item) => (
              <div
                key={item.nr}
                className="py-5 flex items-start gap-6 group hover:pl-2 transition-all duration-200"
              >
                <span className="text-[var(--border)] font-bold text-sm mt-0.5 shrink-0 group-hover:text-[var(--secondary)] transition-colors">
                  {item.nr}
                </span>
                <div>
                  <h3 className="font-semibold text-[var(--foreground)] mb-1 group-hover:text-[var(--primary)] transition-colors">
                    {item.tittel}
                  </h3>
                  <p className="text-[var(--muted)] text-sm leading-relaxed">{item.tekst}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Boliger til salgs */}
      {salgBoliger.length > 0 && (
        <section className="bg-[var(--surface)] border-y border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-2">Salg</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Boliger til salgs</h2>
              </div>
              <Link
                href="/salg"
                className="text-[var(--primary)] text-sm font-semibold hover:underline flex items-center gap-1"
              >
                Se alle →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {salgBoliger.map((bolig) => (
                <BoligKort key={bolig.id} {...bolig} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Boliger til leie */}
      {leieBoliger.length > 0 && (
        <section>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-2">Leie</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Boliger til leie</h2>
              </div>
              <Link
                href="/leie"
                className="text-[var(--primary)] text-sm font-semibold hover:underline"
              >
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

      {/* Team teaser */}
      <section className="bg-[var(--primary)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-4">Teamet</p>
              <h2
                className="font-bold leading-tight mb-6"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.5rem)" }}
              >
                Fire meglere.
                <br />
                Én felles ambisjon.
              </h2>
              <p className="text-white/70 leading-relaxed mb-8 max-w-md">
                Øystein, Magnus, Oskar og Simen jobber for at du alltid er trygg gjennom
                hele prosessen – fra første visning til nøkkeloverlevering.
              </p>
              <Link
                href="/om-oss"
                className="group inline-flex items-center gap-2 bg-white text-[var(--primary)] px-6 py-3 rounded-md font-semibold text-sm hover:bg-blue-50 transition-colors"
              >
                Møt oss
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { navn: "Øystein Nordmo", initialer: "ØN" },
                { navn: "Magnus Nordmo", initialer: "MN" },
                { navn: "Oskar Røhnebækk", initialer: "OR" },
                { navn: "Simen Stensrud", initialer: "SS" },
              ].map((person) => (
                <div
                  key={person.navn}
                  className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-5 border border-white/10"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm mb-3">
                    {person.initialer}
                  </div>
                  <p className="text-white font-medium text-sm leading-snug">{person.navn}</p>
                  <p className="text-white/50 text-xs mt-0.5">Eiendomsmegler</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">Kom i gang</p>
        <h2
          className="font-bold text-[var(--foreground)] mb-5"
          style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}
        >
          Klar for neste steg?
        </h2>
        <p className="text-[var(--muted)] mb-10 max-w-md mx-auto leading-relaxed">
          Ta kontakt med oss for en uforpliktende samtale om dine boligbehov.
          Vi svarer raskt.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/kontakt"
            className="bg-[var(--primary)] text-white px-8 py-3.5 rounded-md font-semibold hover:bg-[var(--primary-light)] transition-colors"
          >
            Kontakt oss
          </Link>
          <Link
            href="/salg"
            className="border border-[var(--border)] text-[var(--foreground)] px-8 py-3.5 rounded-md font-semibold hover:bg-[var(--surface)] transition-colors"
          >
            Se boliger
          </Link>
        </div>
      </section>
    </>
  );
}
