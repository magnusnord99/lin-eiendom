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
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[var(--primary)] to-transparent" />
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 text-white/[0.04] font-black select-none pointer-events-none leading-none animate-fade-in delay-500"
          style={{ fontSize: "clamp(200px, 28vw, 420px)" }}
        >
          LIN
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 lg:py-36 w-full">
          <p className="animate-slide-right text-white/50 text-xs font-semibold uppercase tracking-[0.25em] mb-6">
            Karl Johns Veg 12 · Eiendomsutvikling
          </p>
          <h1
            className="animate-fade-up delay-100 font-bold leading-[1.05] mb-8 text-white"
            style={{ fontSize: "clamp(2.8rem, 7vw, 6rem)" }}
          >
            Vi kjøper, pusser opp
            <br />
            <span className="text-blue-300">og skaper verdi.</span>
          </h1>
          <p className="animate-fade-up delay-200 text-white/70 text-lg leading-relaxed mb-12 max-w-xl">
            LIN Eiendom kjøper boliger som trenger litt kjærlighet, renoverer dem
            grundig og selger eller leier dem ut. Har du et objekt du vil selge?
          </p>
          <div className="animate-fade-up delay-300 flex flex-wrap gap-4">
            <Link
              href="/selg-til-oss"
              className="group bg-white text-[var(--primary)] px-7 py-3.5 rounded-md font-semibold hover:bg-blue-50 transition-all duration-200 flex items-center gap-2"
            >
              Selg til oss
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
            <Link
              href="/boliger"
              className="group border border-white/30 text-white px-7 py-3.5 rounded-md font-semibold hover:bg-white/10 hover:border-white/50 transition-all duration-200 flex items-center gap-2"
            >
              Se våre boliger
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Prosess */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div>
            <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">
              Slik jobber vi
            </p>
            <h2
              className="font-bold text-[var(--foreground)] leading-tight mb-6"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
            >
              Fra slitt til strålende —
              <br />
              det er vår spesialitet.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed text-base max-w-md">
              Vi ser potensialet der andre ser problemer. Med rett kompetanse inhouse
              — fra juss til byggfag — håndterer vi hele prosessen selv.
            </p>
            <Link
              href="/om-oss"
              className="mt-8 inline-flex items-center gap-2 text-[var(--primary)] font-semibold text-sm group"
            >
              <span>Møt teamet</span>
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {[
              { nr: "01", tittel: "Vi kjøper", tekst: "Vi kjøper boliger og eiendommer som trenger renovering, gjerne direkte fra eier uten megler." },
              { nr: "02", tittel: "Vi renoverer", tekst: "Simen og teamet vårt renoverer grundig — fra bad og kjøkken til tak og fasade." },
              { nr: "03", tittel: "Vi selger eller leier ut", tekst: "Ferdig renoverte boliger selges eller leies ut til markedspris." },
              { nr: "04", tittel: "Juridisk trygghet", tekst: "Øystein håndterer alle kontrakter og det juridiske, slik at alt er ryddig for alle parter." },
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

      {/* Boliger */}
      {(salgBoliger.length > 0 || leieBoliger.length > 0) && (
        <section className="bg-[var(--surface)] border-y border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-2">Tilgjengelig nå</p>
                <h2 className="text-2xl font-bold text-[var(--foreground)]">Våre boliger</h2>
              </div>
              <Link href="/boliger" className="text-[var(--primary)] text-sm font-semibold hover:underline">
                Se alle →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...salgBoliger, ...leieBoliger].slice(0, 3).map((bolig) => (
                <BoligKort key={bolig.id} {...bolig} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Selg til oss – teaser */}
      <section className="bg-[var(--foreground)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.2em] mb-4">For selgere</p>
              <h2
                className="font-bold leading-tight mb-6"
                style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)" }}
              >
                Har du en bolig
                <br />
                som trenger oppussing?
              </h2>
              <p className="text-white/70 leading-relaxed mb-8 max-w-md">
                Vi er interessert i objekter som trenger renovering — enten det er en gammel
                enebolig, leilighet eller et nedlagt næringsbygg. Vi gir deg et raskt og
                ærlig tilbud, uten megler og uten stress.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/selg-til-oss"
                  className="group inline-flex items-center gap-2 bg-white text-[var(--foreground)] px-6 py-3 rounded-md font-semibold text-sm hover:bg-gray-100 transition-colors"
                >
                  Send oss objektet ditt
                  <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { tittel: "Rask prosess", tekst: "Vi gir deg tilbud innen 48 timer etter befaring." },
                { tittel: "Ingen megler", tekst: "Du sparer meglerhonorar — vi kjøper direkte fra deg." },
                { tittel: "Alle tilstander", tekst: "Vi er ikke redd for store prosjekter. Jo mer jobb, jo bedre." },
              ].map((item) => (
                <div key={item.tittel} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 transition-colors">
                  <h3 className="font-semibold text-white mb-1">{item.tittel}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{item.tekst}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
                Rett kompetanse
                <br />
                for hele kjeden.
              </h2>
              <p className="text-white/70 leading-relaxed mb-8 max-w-md">
                Fra juridisk due diligence til siste strøk med maling — teamet vårt
                dekker alt inhouse. Det gjør oss raske, fleksible og kostnadseffektive.
              </p>
              <Link
                href="/om-oss"
                className="group inline-flex items-center gap-2 bg-white text-[var(--primary)] px-6 py-3 rounded-md font-semibold text-sm hover:bg-blue-50 transition-colors"
              >
                Les mer om oss
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { navn: "Øystein Nordmo", rolle: "Advokat", initialer: "ØN" },
                { navn: "Magnus Nordmo", rolle: "Dataingeniør", initialer: "MN" },
                { navn: "Oskar Røhnebækk", rolle: "Salg", initialer: "OR" },
                { navn: "Simen Stensrud", rolle: "Byggmester", initialer: "SS" },
              ].map((person) => (
                <div
                  key={person.navn}
                  className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-5 border border-white/10"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm mb-3">
                    {person.initialer}
                  </div>
                  <p className="text-white font-medium text-sm leading-snug">{person.navn}</p>
                  <p className="text-white/50 text-xs mt-0.5">{person.rolle}</p>
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
          Klar for en prat?
        </h2>
        <p className="text-[var(--muted)] mb-10 max-w-md mx-auto leading-relaxed">
          Enten du vil selge en bolig, leie eller kjøpe — ta kontakt, så finner vi ut av det sammen.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/selg-til-oss"
            className="bg-[var(--primary)] text-white px-8 py-3.5 rounded-md font-semibold hover:bg-[var(--primary-light)] transition-colors"
          >
            Selg til oss
          </Link>
          <Link
            href="/kontakt"
            className="border border-[var(--border)] text-[var(--foreground)] px-8 py-3.5 rounded-md font-semibold hover:bg-[var(--surface)] transition-colors"
          >
            Kontakt oss
          </Link>
        </div>
      </section>
    </>
  );
}
