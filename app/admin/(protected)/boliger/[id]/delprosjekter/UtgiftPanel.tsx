"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrerUtgiftAction, slettUtgiftAction } from "./actions";

interface UtgiftPanelProps {
  eiendomId: number;
  delprosjekter: { id: number; navn: string }[];
  eiere: { id: number; navn: string }[];
  utgifter: {
    id: number;
    dato: string;
    kategori: string;
    beskrivelse: string | null;
    leverandor: string | null;
    belop: number;
    harKvittering: boolean;
    delprosjektId: number | null;
    delprosjektNavn: string | null;
    betaltAvBrukerId: number | null;
    betaltAvNavn: string | null;
  }[];
}

const INGEN_DELPROSJEKT = "";
const DRIFTSKONTO = "";

function dagensDatoOslo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}

function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}

export default function UtgiftPanel({ eiendomId, delprosjekter, eiere, utgifter }: UtgiftPanelProps) {
  const router = useRouter();
  const [delprosjektId, setDelprosjektId] = useState(INGEN_DELPROSJEKT);
  const [dato, setDato] = useState(dagensDatoOslo);
  const [kategori, setKategori] = useState("");
  const [leverandor, setLeverandor] = useState("");
  const [belop, setBelop] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [betaltAvBrukerId, setBetaltAvBrukerId] = useState(DRIFTSKONTO);
  const [fil, setFil] = useState<File | null>(null);
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");
  const [slettendeId, setSlettendeId] = useState<number | null>(null);
  const [sletteFeil, setSletteFeil] = useState("");

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  function resetFormFelter() {
    setDelprosjektId(INGEN_DELPROSJEKT);
    setDato(dagensDatoOslo());
    setKategori("");
    setLeverandor("");
    setBelop("");
    setBeskrivelse("");
    setBetaltAvBrukerId(DRIFTSKONTO);
    setFil(null);
  }

  function handleFilEndret(e: React.ChangeEvent<HTMLInputElement>) {
    const valgtFil = e.target.files?.[0] ?? null;
    if (valgtFil && valgtFil.size > 4_000_000) {
      setFeil("Kvitteringsbildet er for stort (maks 4 MB).");
      setFil(null);
      e.target.value = "";
      return;
    }
    setFil(valgtFil);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    try {
      const resultat = await registrerUtgiftAction({
        eiendomId,
        delprosjektId: delprosjektId ? Number(delprosjektId) : undefined,
        dato,
        kategori,
        beskrivelse: beskrivelse || undefined,
        leverandor: leverandor || undefined,
        belop: Number(belop),
        betaltAvBrukerId: betaltAvBrukerId ? Number(betaltAvBrukerId) : undefined,
      });

      if (!resultat.ok) {
        setFeil(resultat.feilmelding);
        return;
      }

      // The expense row now exists. Reset the form and refresh the list
      // immediately, regardless of what happens to the receipt below —
      // this is what proves to the user that re-submitting would create
      // a second expense, not retry a failed one.
      resetFormFelter();
      router.refresh();

      if (fil) {
        try {
          const formData = new FormData();
          formData.append("file", fil);
          const res = await fetch(`/api/utgifter/${resultat.data.id}/kvittering`, { method: "POST", body: formData });
          if (!res.ok) {
            let feilmelding = "ukjent feil";
            try {
              feilmelding = (await res.json()).error ?? feilmelding;
            } catch {
              // Non-JSON error body (e.g. an HTML error page) — keep the generic feilmelding.
            }
            setFeil(`Utgiften ble registrert, men kvitteringsbildet kunne ikke lagres: ${feilmelding}`);
          } else {
            // The first refresh (right after creation) ran before this upload
            // finished, so it could not have seen harKvittering: true yet —
            // refresh again now so the "Kvittering" link appears without
            // the admin needing to reload the page themselves.
            router.refresh();
          }
        } catch {
          // Network failure reaching the upload route at all.
          setFeil("Utgiften ble registrert, men kvitteringsbildet kunne ikke lagres (nettverksfeil).");
        }
      }
    } catch {
      setFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  async function handleSlett(id: number) {
    if (!window.confirm("Er du sikker på at du vil slette denne utgiften?")) {
      return;
    }

    setSlettendeId(id);
    setSletteFeil("");

    try {
      const resultat = await slettUtgiftAction(id);

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

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelKlasse}>Delprosjekt</label>
            <select value={delprosjektId} onChange={(e) => setDelprosjektId(e.target.value)} className={inputKlasse}>
              <option value={INGEN_DELPROSJEKT}>Ingen (eiendom)</option>
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
            <label className={labelKlasse}>Kategori *</label>
            <input
              type="text"
              required
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className={inputKlasse}
              placeholder="F.eks. Materialer"
            />
          </div>
          <div>
            <label className={labelKlasse}>Leverandør</label>
            <input
              type="text"
              value={leverandor}
              onChange={(e) => setLeverandor(e.target.value)}
              className={inputKlasse}
              placeholder="Valgfritt"
            />
          </div>
          <div>
            <label className={labelKlasse}>Beløp (kr) *</label>
            <input
              type="number"
              required
              step="1"
              min="0"
              value={belop}
              onChange={(e) => setBelop(e.target.value)}
              className={inputKlasse}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelKlasse}>Beskrivelse</label>
            <input
              type="text"
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              className={inputKlasse}
              placeholder="Valgfritt"
            />
          </div>
          <div>
            <label className={labelKlasse}>Betalt av</label>
            <select value={betaltAvBrukerId} onChange={(e) => setBetaltAvBrukerId(e.target.value)} className={inputKlasse}>
              <option value={DRIFTSKONTO}>Driftskonto</option>
              {eiere.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelKlasse}>Kvittering</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFilEndret}
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
          {laster ? "Lagrer..." : "Registrer utgift"}
        </button>
      </form>

      {sletteFeil && <p className="text-red-600 text-sm">{sletteFeil}</p>}

      {utgifter.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ingen utgifter registrert.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {utgifter.map((rad) => (
            <li key={rad.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {formaterDatoNorsk(rad.dato)} – {rad.kategori} – {rad.delprosjektNavn ?? "Eiendom"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {new Intl.NumberFormat("nb-NO").format(rad.belop)} kr – {rad.betaltAvNavn ?? "Driftskonto"}
                  {rad.beskrivelse ? ` – ${rad.beskrivelse}` : ""}
                  {rad.harKvittering && (
                    <>
                      {" – "}
                      <a
                        href={`/api/utgifter/${rad.id}/kvittering`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary)] hover:underline"
                      >
                        Kvittering
                      </a>
                    </>
                  )}
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
