import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BoligKort from "@/components/BoligKort";
import ScrollReveal from "@/components/ScrollReveal";

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
            Yappuccino AS kjøper boliger som trenger litt kjærlighet, renoverer dem
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
          <ScrollReveal direction="left">
            <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">
              Slik jobber vi
            </p>
            <h2
              className="font-bold text-[var(--foreground)] leading-tight mb-6"
              style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)" }}
            >
              Vi ser potensialet
              <br />
              der andre ser arbeid.
            </h2>
            <p className="text-[var(--muted)] leading-relaxed text-base max-w-md">
              Med rett kompetanse inhouse — fra juss til byggfag — håndterer vi
              hele kjeden selv. Raskt, effektivt og med kvalitet i bunn.
            </p>
            <Link
              href="/om-oss"
              className="mt-8 inline-flex items-center gap-2 text-[var(--primary)] font-semibold text-sm group"
            >
              <span>Møt teamet</span>
              <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </Link>
          </ScrollReveal>

          <div className="divide-y divide-[var(--border)]">
            {[
              { nr: "01", tittel: "Vi kjøper", tekst: "Vi kjøper boliger og eiendommer som trenger renovering, gjerne direkte fra eier uten megler.", delay: 0 },
              { nr: "02", tittel: "Vi renoverer", tekst: "Vi renoverer grundig — fra bad og kjøkken til tak og fasade.", delay: 100 },
              { nr: "03", tittel: "Vi selger eller leier ut", tekst: "Ferdig renoverte boliger selges eller leies ut til markedspris.", delay: 200 },
              { nr: "04", tittel: "Juridisk trygghet", tekst: "Vi håndterer alle kontrakter og det juridiske, slik at alt er ryddig for alle parter.", delay: 300 },
            ].map((item) => (
              <ScrollReveal key={item.nr} delay={item.delay}>
                <div className="py-5 flex items-start gap-6 group hover:pl-2 transition-all duration-200">
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
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Boliger */}
      {(salgBoliger.length > 0 || leieBoliger.length > 0) && (
        <section className="bg-[var(--surface)] border-y border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <ScrollReveal>
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-2">Tilgjengelig nå</p>
                  <h2 className="text-2xl font-bold text-[var(--foreground)]">Våre boliger</h2>
                </div>
                <Link href="/boliger" className="text-[var(--primary)] text-sm font-semibold hover:underline">
                  Se alle →
                </Link>
              </div>
            </ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...salgBoliger, ...leieBoliger].slice(0, 3).map((bolig, i) => (
                <ScrollReveal key={bolig.id} delay={i * 100}>
                  <BoligKort {...bolig} />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Selg til oss – teaser */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal direction="left">
              <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">For selgere</p>
              <h2
                className="font-bold leading-tight mb-6 text-[var(--foreground)]"
                style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)" }}
              >
                Har du en bolig
                <br />
                som trenger oppussing?
              </h2>
              <p className="text-[var(--muted)] leading-relaxed mb-8 max-w-md">
                Vi er interessert i objekter som trenger renovering — enten det er en gammel
                enebolig, leilighet eller et nedlagt næringsbygg. Vi gir deg et raskt og
                ærlig tilbud, uten megler og uten stress.
              </p>
              <Link
                href="/selg-til-oss"
                className="group inline-flex items-center gap-2 bg-[var(--primary)] text-white px-6 py-3 rounded-md font-semibold text-sm hover:bg-[var(--primary-light)] transition-colors"
              >
                Send oss objektet ditt
                <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </Link>
            </ScrollReveal>

            <div className="grid grid-cols-1 gap-4">
              {[
                { tittel: "Rask prosess", tekst: "Vi gir deg tilbud innen 48 timer etter befaring.", delay: 0 },
                { tittel: "Ingen megler", tekst: "Du sparer meglerhonorar — vi kjøper direkte fra deg.", delay: 100 },
                { tittel: "Alle tilstander", tekst: "Vi er ikke redd for store prosjekter. Jo mer jobb, jo bedre.", delay: 200 },
              ].map((item) => (
                <ScrollReveal key={item.tittel} delay={item.delay}>
                  <div className="bg-white border border-[var(--border)] rounded-xl p-5 hover:shadow-sm hover:border-[var(--secondary)] transition-all duration-200">
                    <h3 className="font-semibold text-[var(--foreground)] mb-1">{item.tittel}</h3>
                    <p className="text-[var(--muted)] text-sm leading-relaxed">{item.tekst}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team teaser */}
      <section className="bg-[var(--primary)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal direction="left">
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
            </ScrollReveal>

            <div className="grid grid-cols-2 gap-3">
              {[
                { navn: "Øystein Nordmo", rolle: "Advokat", initialer: "ØN", delay: 0 },
                { navn: "Magnus Nordmo", rolle: "Dataingeniør", initialer: "MN", delay: 100 },
                { navn: "Oskar Røhnebækk", rolle: "Salg", initialer: "OR", delay: 200 },
                { navn: "Simen Stensrud", rolle: "Byggmester", initialer: "SS", delay: 300 },
              ].map((person) => (
                <ScrollReveal key={person.navn} delay={person.delay}>
                  <div className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl p-5 border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm mb-3">
                      {person.initialer}
                    </div>
                    <p className="text-white font-medium text-sm leading-snug">{person.navn}</p>
                    <p className="text-white/50 text-xs mt-0.5">{person.rolle}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <ScrollReveal>
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
        </ScrollReveal>
      </section>
    </>
  );
}
