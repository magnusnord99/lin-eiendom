import KontaktSkjema from "@/components/KontaktSkjema";

export default function KontaktPage() {
  return (
    <div>
      {/* Header */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-[var(--secondary)] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Kontakt</p>
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
              <div className="space-y-5">
                {[
                  { label: "Adresse", verdi: "Karl Johns Veg 12" },
                  { label: "Telefon", verdi: "+47 952 37 615" },
                  { label: "E-post", verdi: "post@lineiendom.no" },
                  { label: "Åpningstider", verdi: "Man–Fre: 08:00–17:00" },
                ].map((info) => (
                  <div key={info.label}>
                    <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-0.5">{info.label}</p>
                    <p className="font-medium text-[var(--foreground)]">{info.verdi}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-6">
              <p className="text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider mb-2">Vil du selge en bolig?</p>
              <p className="text-[var(--muted)] text-sm leading-relaxed mb-4">
                Har du et objekt som trenger renovering? Vi kjøper direkte — uten megler.
              </p>
              <a
                href="/selg-til-oss"
                className="inline-block text-[var(--primary)] font-semibold text-sm hover:underline"
              >
                Gå til Selg til oss →
              </a>
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
