"use client";

import { useState } from "react";

export default function SelgSkjema() {
  const [form, setForm] = useState({
    navn: "",
    telefon: "",
    epost: "",
    adresse: "",
    tilstand: "",
    melding: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  function oppdater(felt: string, verdi: string) {
    setForm((f) => ({ ...f, [felt]: verdi }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const melding = `SELG TIL OSS\n\nAdresse på objekt: ${form.adresse}\nTilstand: ${form.tilstand}\n\nMelding: ${form.melding}`;

    const res = await fetch("/api/kontakt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        navn: form.navn,
        epost: form.epost,
        telefon: form.telefon,
        melding,
      }),
    });

    setStatus(res.ok ? "success" : "error");
  }

  const inputKlasse =
    "w-full px-3 py-2.5 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1.5";

  if (status === "success") {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-bold text-[var(--foreground)] text-lg mb-2">Takk! Vi tar kontakt.</h3>
        <p className="text-[var(--muted)] text-sm">
          Vi ser på objektet ditt og gir deg tilbakemelding innen 48 timer.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelKlasse}>Navn *</label>
          <input
            required
            type="text"
            value={form.navn}
            onChange={(e) => oppdater("navn", e.target.value)}
            className={inputKlasse}
            placeholder="Ola Nordmann"
          />
        </div>
        <div>
          <label className={labelKlasse}>Telefon</label>
          <input
            type="tel"
            value={form.telefon}
            onChange={(e) => oppdater("telefon", e.target.value)}
            className={inputKlasse}
            placeholder="+47 000 00 000"
          />
        </div>
      </div>

      <div>
        <label className={labelKlasse}>E-post *</label>
        <input
          required
          type="email"
          value={form.epost}
          onChange={(e) => oppdater("epost", e.target.value)}
          className={inputKlasse}
          placeholder="ola@eksempel.no"
        />
      </div>

      <div>
        <label className={labelKlasse}>Adresse på objektet *</label>
        <input
          required
          type="text"
          value={form.adresse}
          onChange={(e) => oppdater("adresse", e.target.value)}
          className={inputKlasse}
          placeholder="Gatenavn 1, 0000 By"
        />
      </div>

      <div>
        <label className={labelKlasse}>Tilstand / type bolig</label>
        <select
          value={form.tilstand}
          onChange={(e) => oppdater("tilstand", e.target.value)}
          className={inputKlasse}
        >
          <option value="">Velg tilstand</option>
          <option value="Lett oppussing">Lett oppussing</option>
          <option value="Moderat oppussing">Moderat oppussing</option>
          <option value="Total rehabilitering">Total rehabilitering</option>
          <option value="Usikker">Usikker / vet ikke</option>
        </select>
      </div>

      <div>
        <label className={labelKlasse}>Kort beskrivelse (valgfritt)</label>
        <textarea
          value={form.melding}
          onChange={(e) => oppdater("melding", e.target.value)}
          rows={4}
          className={inputKlasse + " resize-none"}
          placeholder="Fortell gjerne litt om boligen, hva som trengs og ønsket pris om du har det..."
        />
      </div>

      {status === "error" && (
        <p className="text-red-600 text-sm">Noe gikk galt. Prøv igjen eller ring oss.</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-[var(--primary)] text-white py-3 rounded-md font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50 text-sm"
      >
        {status === "loading" ? "Sender..." : "Send inn objektet ditt"}
      </button>
    </form>
  );
}
