"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrerInnskuddAction, slettInnskuddAction } from "./actions";

interface KapitalPanelProps {
  eiendomId: number;
  eiere: { id: number; navn: string }[];
  innskudd: {
    id: number;
    dato: string;
    belop: number;
    beskrivelse: string | null;
    brukerId: number;
    brukerNavn: string;
  }[];
}

function dagensDatoOslo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}

function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}

export default function KapitalPanel({ eiendomId, eiere, innskudd }: KapitalPanelProps) {
  const router = useRouter();
  const [brukerId, setBrukerId] = useState("");
  const [dato, setDato] = useState(dagensDatoOslo);
  const [belop, setBelop] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");
  const [slettendeId, setSlettendeId] = useState<number | null>(null);
  const [sletteFeil, setSletteFeil] = useState("");

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  const effectiveBrukerId = eiere.some((e) => String(e.id) === brukerId)
    ? brukerId
    : String(eiere[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    try {
      const resultat = await registrerInnskuddAction({
        eiendomId,
        brukerId: Number(effectiveBrukerId),
        dato,
        belop: Number(belop),
        beskrivelse: beskrivelse || undefined,
      });

      if (resultat.ok) {
        setDato(dagensDatoOslo());
        setBelop("");
        setBeskrivelse("");
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

  async function handleSlett(id: number) {
    setSlettendeId(id);
    setSletteFeil("");

    try {
      const resultat = await slettInnskuddAction(id);

      if (resultat.ok) {
        router.refresh();
      } else {
        setSletteFeil(resultat.feilmelding);
      }
    } catch {
      setSletteFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setSlettendeId(null);
    }
  }

  if (eiere.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Ingen eiere registrert.</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelKlasse}>Eier *</label>
            <select
              required
              value={effectiveBrukerId}
              onChange={(e) => setBrukerId(e.target.value)}
              className={inputKlasse}
            >
              {eiere.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelKlasse}>Dato *</label>
            <input type="date" required value={dato} onChange={(e) => setDato(e.target.value)} className={inputKlasse} />
          </div>
          <div>
            <label className={labelKlasse}>Beløp (kr) *</label>
            <input
              type="number"
              required
              step="1"
              min="1"
              value={belop}
              onChange={(e) => setBelop(e.target.value)}
              className={inputKlasse}
              placeholder="0"
            />
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
          {laster ? "Lagrer..." : "Registrer innskudd"}
        </button>
      </form>

      {sletteFeil && <p className="text-red-600 text-sm">{sletteFeil}</p>}

      {innskudd.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ingen innskudd registrert.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {innskudd.map((rad) => (
            <li key={rad.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formaterDatoNorsk(rad.dato)} – {rad.brukerNavn}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {new Intl.NumberFormat("nb-NO").format(rad.belop)} kr
                  {rad.beskrivelse ? ` – ${rad.beskrivelse}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleSlett(rad.id)}
                disabled={slettendeId === rad.id}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {slettendeId === rad.id ? "Sletter..." : "Slett"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
