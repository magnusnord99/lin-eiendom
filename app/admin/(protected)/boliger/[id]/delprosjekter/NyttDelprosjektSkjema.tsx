"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { opprettDelprosjektAction } from "./actions";

interface NyttDelprosjektSkjemaProps {
  eiendomId: number;
}

export default function NyttDelprosjektSkjema({ eiendomId }: NyttDelprosjektSkjemaProps) {
  const router = useRouter();
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [budsjett, setBudsjett] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    try {
      await opprettDelprosjektAction({
        eiendomId,
        navn,
        beskrivelse: beskrivelse || undefined,
        budsjett: budsjett ? parseInt(budsjett) : undefined,
      });
      setNavn("");
      setBeskrivelse("");
      setBudsjett("");
      router.refresh();
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
    }
    setLaster(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelKlasse}>Navn *</label>
          <input type="text" required value={navn} onChange={(e) => setNavn(e.target.value)} className={inputKlasse} placeholder="f.eks. Kjøkken" />
        </div>
        <div>
          <label className={labelKlasse}>Budsjett (kr)</label>
          <input type="number" value={budsjett} onChange={(e) => setBudsjett(e.target.value)} className={inputKlasse} placeholder="0" />
        </div>
        <div>
          <label className={labelKlasse}>Beskrivelse</label>
          <input type="text" value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} className={inputKlasse} placeholder="Valgfritt" />
        </div>
      </div>

      {feil && <p className="text-red-600 text-sm">{feil}</p>}

      <button
        type="submit"
        disabled={laster}
        className="px-4 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
      >
        {laster ? "Lagrer..." : "Legg til delprosjekt"}
      </button>
    </form>
  );
}
