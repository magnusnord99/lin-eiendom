import KontaktSkjema from "@/components/KontaktSkjema";

export default function KontaktPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-[var(--secondary)] text-sm font-medium uppercase tracking-widest mb-3">Kontakt</p>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-3">Ta kontakt med oss</h1>
          <p className="text-[var(--muted)]">Vi svarer deg innen én virkedag.</p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Kontaktinfo */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-semibold text-[var(--foreground)] mb-5">Kontaktinformasjon</h2>
              <div className="space-y-4">
                {[
                  { ikon: "📍", label: "Adresse", verdi: "Storgata 1, 0155 Oslo" },
                  { ikon: "📞", label: "Telefon", verdi: "+47 22 33 44 55" },
                  { ikon: "✉️", label: "E-post", verdi: "post@lineiendom.no" },
                  { ikon: "🕐", label: "Åpningstider", verdi: "Man–Fre: 09:00–17:00" },
                ].map((info) => (
                  <div key={info.label} className="flex items-start gap-4">
                    <span className="text-xl shrink-0">{info.ikon}</span>
                    <div>
                      <p className="text-sm text-[var(--muted)]">{info.label}</p>
                      <p className="font-medium text-[var(--foreground)]">{info.verdi}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Skjema */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-[var(--border)] rounded-xl p-8 shadow-sm">
              <h2 className="font-semibold text-[var(--foreground)] mb-6">Send oss en melding</h2>
              <KontaktSkjema />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
