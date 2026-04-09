import SelgSkjema from "@/components/SelgSkjema";

export default function SelgTilOssPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--foreground)] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-[0.25em] mb-5">Selg til oss</p>
            <h1
              className="font-bold text-white leading-tight mb-6"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
            >
              Har du en bolig som
              <br />
              trenger litt kjærlighet?
            </h1>
            <p className="text-white/65 text-lg leading-relaxed">
              Vi kjøper boliger og eiendommer i alle tilstander — direkte fra eier,
              uten megler. Raskt, ryddig og uten unødvendig bry.
            </p>
          </div>
        </div>
      </section>

      {/* Fordeler */}
      <section className="bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { nr: "48t", tittel: "Tilbud innen 48 timer", tekst: "Etter befaring gir vi deg et skriftlig tilbud raskt." },
              { nr: "0%", tittel: "Ingen meglerhonorar", tekst: "Du selger direkte til oss — ingen mellommann, ingen provisjon." },
              { nr: "∞", tittel: "Alle tilstander", tekst: "Vi er spesialister på krevende objekter. Jo mer jobb, jo bedre." },
            ].map((item) => (
              <div key={item.tittel} className="text-center p-6">
                <p className="text-4xl font-black text-[var(--primary)] mb-3">{item.nr}</p>
                <h3 className="font-bold text-[var(--foreground)] mb-2">{item.tittel}</h3>
                <p className="text-[var(--muted)] text-sm leading-relaxed">{item.tekst}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skjema + info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Venstre: info */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="font-bold text-[var(--foreground)] text-xl mb-4">Slik fungerer det</h2>
              <div className="space-y-5">
                {[
                  { steg: "1", tekst: "Fyll ut skjemaet med adresse og litt info om objektet." },
                  { steg: "2", tekst: "Vi tar kontakt og avtaler en befaring — på dine premisser." },
                  { steg: "3", tekst: "Du mottar et skriftlig, uforpliktende tilbud innen 48 timer." },
                  { steg: "4", tekst: "Vi gjennomfører kjøpet raskt og ryddig — Øystein ordner papirene." },
                ].map((s) => (
                  <div key={s.steg} className="flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {s.steg}
                    </div>
                    <p className="text-[var(--muted)] text-sm leading-relaxed">{s.tekst}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
              <p className="text-xs font-semibold text-[var(--secondary)] uppercase tracking-wider mb-3">Foretrekker du å ringe?</p>
              <p className="font-bold text-[var(--foreground)] text-lg mb-1">+47 22 33 44 55</p>
              <p className="text-[var(--muted)] text-sm">Tilgjengelig man–fre 08–17</p>
            </div>
          </div>

          {/* Høyre: skjema */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-[var(--border)] rounded-xl p-8 shadow-sm">
              <h2 className="font-bold text-[var(--foreground)] text-lg mb-2">Send oss objektet ditt</h2>
              <p className="text-[var(--muted)] text-sm mb-7">Uforpliktende — vi kommer tilbake til deg raskt.</p>
              <SelgSkjema />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
