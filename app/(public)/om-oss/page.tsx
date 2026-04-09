const team = [
  {
    navn: "Øystein Nordmo",
    initialer: "ØN",
    tittel: "Advokat",
    bio: "Øystein håndterer alle juridiske aspekter — fra due diligence og kontraktsforhandlinger til tinglysing. Du er alltid i trygge hender.",
  },
  {
    navn: "Magnus Nordmo",
    initialer: "MN",
    tittel: "Dataingeniør",
    bio: "Magnus bygger systemene som gjør oss effektive — fra boligoversikt og analyse til interne verktøy som sparer tid og penger.",
  },
  {
    navn: "Oskar Røhnebækk",
    initialer: "OR",
    tittel: "Salg",
    bio: "Oskar sørger for at ferdigrenoverte boliger selges raskt og til riktig pris. Han håndterer visninger, forhandlinger og oppgjør.",
  },
  {
    navn: "Simen Stensrud",
    initialer: "SS",
    tittel: "Byggmester",
    bio: "Simen leder alle oppussingsprosjekter. Med bred fagkompetanse sikrer han høy kvalitet, overholdelse av budsjett og fremdrift.",
  },
];

export default function OmOssPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--primary)] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-[0.25em] mb-5">Om oss</p>
            <h1
              className="animate-fade-up font-bold text-white leading-tight mb-6"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}
            >
              Vi ser verdien
              <br />
              der andre ser arbeid.
            </h1>
            <p className="animate-fade-up delay-200 text-white/70 text-lg leading-relaxed max-w-lg">
              LIN Eiendom kjøper boliger som trenger renovering, pusser dem opp og
              selger eller leier dem ut. Med advokat, byggmester, selger og ingeniør
              inhouse — gjør vi alt selv.
            </p>
          </div>
        </div>
      </section>

      {/* Konsept */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)] rounded-xl overflow-hidden border border-[var(--border)]">
          {[
            {
              nr: "01",
              tittel: "Vi kjøper riktig",
              tekst: "Vi søker aktivt etter objekter med potensial — boliger som er utdaterte, slitte eller trenger strukturell oppgradering.",
            },
            {
              nr: "02",
              tittel: "Vi renoverer grundig",
              tekst: "Alt fra bad og kjøkken til tak, fasade og tekniske anlegg. Simen og hans team leverer håndverkskvalitet du merker.",
            },
            {
              nr: "03",
              tittel: "Vi skaper verdi",
              tekst: "Ferdig renoverte boliger selges eller leies ut. Oskar sørger for riktig pris og rask prosess.",
            },
          ].map((v) => (
            <div key={v.tittel} className="bg-white p-8 lg:p-10">
              <p className="text-[var(--border)] font-bold text-sm mb-5">{v.nr}</p>
              <h3 className="font-bold text-[var(--foreground)] text-xl mb-3">{v.tittel}</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">{v.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="mb-12">
            <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Teamet</p>
            <h2 className="text-3xl font-bold text-[var(--foreground)]">Menneskene bak LIN</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((person) => (
              <div
                key={person.navn}
                className="bg-white rounded-xl border border-[var(--border)] overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-32 bg-[var(--primary)] relative overflow-hidden flex items-center justify-center">
                  <div
                    className="absolute inset-0 opacity-[0.08]"
                    style={{
                      backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                    {person.initialer}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-[var(--foreground)] text-sm">{person.navn}</h3>
                  <p className="text-[var(--secondary)] text-xs font-semibold mb-3 uppercase tracking-wider">{person.tittel}</p>
                  <p className="text-[var(--muted)] text-xs leading-relaxed">{person.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Adresse + CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-4">Finn oss</p>
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">Karl Johns Veg 12</h2>
        <p className="text-[var(--muted)] mb-8">Kontortid mandag–fredag, 08:00–17:00</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a
            href="/selg-til-oss"
            className="inline-block bg-[var(--primary)] text-white px-8 py-3 rounded-md font-semibold hover:bg-[var(--primary-light)] transition-colors text-sm"
          >
            Selg til oss
          </a>
          <a
            href="/kontakt"
            className="inline-block border border-[var(--border)] text-[var(--foreground)] px-8 py-3 rounded-md font-semibold hover:bg-[var(--surface)] transition-colors text-sm"
          >
            Send en melding
          </a>
        </div>
      </section>
    </div>
  );
}
