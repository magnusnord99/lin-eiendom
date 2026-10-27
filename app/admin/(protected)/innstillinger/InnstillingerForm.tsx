"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { oppdaterInnstillingAction } from "./actions";

interface InnstillingerFormProps {
  initial: { arbeidstimerAndelProsent: number; kapitalAndelProsent: number };
}

export default function InnstillingerForm({ initial }: InnstillingerFormProps) {
  const router = useRouter();
  const [arbeidstimerAndelProsent, setArbeidstimerAndelProsent] = useState(
    initial.arbeidstimerAndelProsent.toString()
  );
  const [kapitalAndelProsent, setKapitalAndelProsent] = useState(initial.kapitalAndelProsent.toString());
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    try {
      const resultat = await oppdaterInnstillingAction({
        arbeidstimerAndelProsent: Number(arbeidstimerAndelProsent),
        kapitalAndelProsent: Number(kapitalAndelProsent),
      });

      if (resultat.ok) {
        router.refresh();
      } else {
        setFeil(resultat.feilmelding);
      }
    } catch {
      setFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelKlasse}>Arbeidstimer-andel (%)</label>
          <input
            type="number"
            required
            step="0.1"
            min="0"
            max="100"
            value={arbeidstimerAndelProsent}
            onChange={(e) => setArbeidstimerAndelProsent(e.target.value)}
            className={inputKlasse}
          />
        </div>
        <div>
          <label className={labelKlasse}>Kapitalandel (%)</label>
          <input
            type="number"
            required
            step="0.1"
            min="0"
            max="100"
            value={kapitalAndelProsent}
            onChange={(e) => setKapitalAndelProsent(e.target.value)}
            className={inputKlasse}
          />
        </div>
      </div>

      {feil && <p className="text-red-600 text-sm">{feil}</p>}

      <button
        type="submit"
        disabled={laster}
        className="px-4 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
      >
        {laster ? "Lagrer..." : "Lagre"}
      </button>
    </form>
  );
}
