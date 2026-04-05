export default function OmOssPage() {
  const team = [
    { navn: "Line Andersen", tittel: "Daglig leder & Eiendomsmegler", bio: "Over 15 års erfaring i eiendomsbransjen. Spesialist på boligsalg i Oslo og omegn." },
    { navn: "Ingrid Nilsen", tittel: "Eiendomsmegler", bio: "Ekspert på utleie og forvaltning. Hjelper både leietakere og utleiere med trygge leieforhold." },
    { navn: "Nikolai Berg", tittel: "Markedsansvarlig", bio: "Ansvarlig for markedsføring og digitale kanaler. Sikrer at boligene dine når riktig kjøper." },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-2xl">
            <p className="text-[var(--secondary)] text-sm font-medium uppercase tracking-widest mb-3">Om oss</p>
            <h1 className="text-4xl font-bold text-[var(--foreground)] mb-5">
              Et eiendomsbyrå du kan stole på
            </h1>
            <p className="text-[var(--muted)] text-lg leading-relaxed">
              LIN Eiendom ble grunnlagt med én visjon: å gjøre bolighandel enkel, trygg og
              personlig. Vi kombinerer lokal kunnskap med profesjonell service for å gi deg
              den beste opplevelsen.
            </p>
          </div>
        </div>
      </section>

      {/* Verdier */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-[var(--foreground)] mb-10 text-center">Våre verdier</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { ikon: "🤝", tittel: "Ærlighet", tekst: "Vi gir deg ærlige råd, selv når det ikke er det du ønsker å høre. Din tillit er vår viktigste verdi." },
            { ikon: "🔍", tittel: "Grundighet", tekst: "Vi jobber nøye og detaljert i alle ledd – fra verdivurdering til kontraktssignering." },
            { ikon: "💼", tittel: "Profesjonalitet", tekst: "Alle i teamet vårt er sertifiserte og har lang erfaring. Du er i trygge hender." },
          ].map((v) => (
            <div key={v.tittel} className="text-center p-8 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
              <div className="text-4xl mb-4">{v.ikon}</div>
              <h3 className="font-bold text-[var(--foreground)] text-lg mb-3">{v.tittel}</h3>
              <p className="text-[var(--muted)] text-sm leading-relaxed">{v.tekst}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section className="bg-[var(--surface)] border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-[var(--foreground)] mb-10 text-center">Møt teamet</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {team.map((person) => (
              <div key={person.navn} className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold">
                    {person.navn.charAt(0)}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-[var(--foreground)]">{person.navn}</h3>
                  <p className="text-[var(--secondary)] text-sm font-medium mb-3">{person.tittel}</p>
                  <p className="text-[var(--muted)] text-sm leading-relaxed">{person.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
