"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrerTimerAction, slettTimeregistreringAction } from "./actions";

interface TimeregistreringPanelProps {
  eiendomId: number;
  delprosjekter: { id: number; navn: string }[];
  timer: {
    id: number;
    dato: string;
    antallTimer: number;
    beskrivelse: string | null;
    delprosjektNavn: string;
    brukerId: number;
    brukerNavn: string;
  }[];
  naavarendeBrukerId: number;
}

function dagensDatoOslo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}

function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}

export default function TimeregistreringPanel({
  eiendomId,
  delprosjekter,
  timer,
  naavarendeBrukerId,
}: TimeregistreringPanelProps) {
  const router = useRouter();
  const [delprosjektId, setDelprosjektId] = useState("");
  const [dato, setDato] = useState(dagensDatoOslo);
  const [antallTimer, setAntallTimer] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");
  const [slettendeId, setSlettendeId] = useState<number | null>(null);
  const [sletteFeil, setSletteFeil] = useState("");

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  const effectiveDelprosjektId = delprosjekter.some((d) => String(d.id) === delprosjektId)
    ? delprosjektId
    : String(delprosjekter[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    try {
      const resultat = await registrerTimerAction({
        eiendomId,
        delprosjektId: Number(effectiveDelprosjektId),
        dato,
        antallTimer: Number(antallTimer),
        beskrivelse: beskrivelse || undefined,
      });

      if (resultat.ok) {
        setDato(dagensDatoOslo());
        setAntallTimer("");
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
      const resultat = await slettTimeregistreringAction(id);

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

  if (delprosjekter.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Ingen delprosjekter registrert.</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelKlasse}>Delprosjekt *</label>
            <select
              required
              value={effectiveDelprosjektId}
              onChange={(e) => setDelprosjektId(e.target.value)}
              className={inputKlasse}
            >
              {delprosjekter.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelKlasse}>Dato *</label>
            <input type="date" required value={dato} onChange={(e) => setDato(e.target.value)} className={inputKlasse} />
          </div>
          <div>
            <label className={labelKlasse}>Antall timer *</label>
            <input
              type="number"
              required
              step="0.5"
              min="0"
              value={antallTimer}
              onChange={(e) => setAntallTimer(e.target.value)}
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
          {laster ? "Lagrer..." : "Registrer timer"}
        </button>
      </form>

      {sletteFeil && <p className="text-red-600 text-sm">{sletteFeil}</p>}

      {timer.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ingen timer registrert.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {timer.map((rad) => (
            <li key={rad.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formaterDatoNorsk(rad.dato)} – {rad.delprosjektNavn}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {rad.antallTimer} t – {rad.brukerNavn}
                  {rad.beskrivelse ? ` – ${rad.beskrivelse}` : ""}
                </p>
              </div>
              {rad.brukerId === naavarendeBrukerId && (
                <button
                  type="button"
                  onClick={() => handleSlett(rad.id)}
                  disabled={slettendeId === rad.id}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {slettendeId === rad.id ? "Sletter..." : "Slett"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
