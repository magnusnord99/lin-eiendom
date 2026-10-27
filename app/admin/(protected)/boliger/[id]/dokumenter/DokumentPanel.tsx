"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOKUMENT_KATEGORIER, KATEGORI_LABELS, type DokumentKategori } from "@/lib/dokument";

interface DokumentPanelProps {
  eiendomId: number;
  delprosjekter: { id: number; navn: string }[];
  dokumenter: {
    id: number;
    kategori: string;
    navn: string;
    mimeType: string;
    storrelse: number;
    opprettet: string;
    delprosjektId: number | null;
    delprosjektNavn: string | null;
    opplastetAvBrukerId: number;
    opplastetAvNavn: string;
  }[];
}

const INGEN_DELPROSJEKT = "";
const FILTER_ALLE = "alle";
const FILTER_INGEN_DELPROSJEKT = "ingen";

function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}

function formaterStorrelse(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function kategoriLabel(kategori: string): string {
  return KATEGORI_LABELS[kategori as DokumentKategori] ?? kategori;
}

export default function DokumentPanel({ eiendomId, delprosjekter, dokumenter }: DokumentPanelProps) {
  const router = useRouter();
  const [delprosjektId, setDelprosjektId] = useState(INGEN_DELPROSJEKT);
  const [kategori, setKategori] = useState<DokumentKategori>(DOKUMENT_KATEGORIER[0]);
  const [navn, setNavn] = useState("");
  const [fil, setFil] = useState<File | null>(null);
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");
  const [slettendeId, setSlettendeId] = useState<number | null>(null);
  const [sletteFeil, setSletteFeil] = useState("");

  const [kategoriFilter, setKategoriFilter] = useState<string>(FILTER_ALLE);
  const [delprosjektFilter, setDelprosjektFilter] = useState<string>(FILTER_ALLE);

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  function resetFormFelter() {
    setDelprosjektId(INGEN_DELPROSJEKT);
    setKategori(DOKUMENT_KATEGORIER[0]);
    setNavn("");
    setFil(null);
  }

  function handleFilEndret(e: React.ChangeEvent<HTMLInputElement>) {
    const valgtFil = e.target.files?.[0] ?? null;
    setFil(valgtFil);
    if (valgtFil && !navn) {
      setNavn(valgtFil.name);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fil) {
      setFeil("Ingen fil valgt.");
      return;
    }

    setLaster(true);
    setFeil("");

    try {
      const formData = new FormData();
      formData.append("file", fil);
      formData.append("eiendomId", String(eiendomId));
      formData.append("kategori", kategori);
      if (delprosjektId) {
        formData.append("delprosjektId", delprosjektId);
      }
      if (navn.trim()) {
        formData.append("navn", navn.trim());
      }

      const res = await fetch("/api/dokumenter", { method: "POST", body: formData });

      if (!res.ok) {
        let feilmelding = "Noe gikk galt. Prøv igjen.";
        try {
          feilmelding = (await res.json()).error ?? feilmelding;
        } catch {
          // Non-JSON error body (e.g. an HTML error page) — keep the generic feilmelding.
        }
        setFeil(feilmelding);
        return;
      }

      resetFormFelter();
      router.refresh();
    } catch {
      setFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setLaster(false);
    }
  }

  async function handleSlett(id: number) {
    if (!window.confirm("Er du sikker på at du vil slette dette dokumentet?")) {
      return;
    }

    setSlettendeId(id);
    setSletteFeil("");

    try {
      const res = await fetch(`/api/dokumenter/${id}`, { method: "DELETE" });

      if (!res.ok) {
        let feilmelding = "Noe gikk galt. Prøv igjen.";
        try {
          feilmelding = (await res.json()).error ?? feilmelding;
        } catch {
          // Non-JSON error body — keep the generic feilmelding.
        }
        setSletteFeil(feilmelding);
        return;
      }

      router.refresh();
    } catch {
      setSletteFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setSlettendeId(null);
    }
  }

  const dokumenterFiltrert = dokumenter.filter((d) => {
    if (kategoriFilter !== FILTER_ALLE && d.kategori !== kategoriFilter) {
      return false;
    }

    if (delprosjektFilter === FILTER_INGEN_DELPROSJEKT && d.delprosjektId !== null) {
      return false;
    }

    if (
      delprosjektFilter !== FILTER_ALLE &&
      delprosjektFilter !== FILTER_INGEN_DELPROSJEKT &&
      String(d.delprosjektId) !== delprosjektFilter
    ) {
      return false;
    }

    return true;
  });

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
            <label className={labelKlasse}>Kategori *</label>
            <select
              required
              value={kategori}
              onChange={(e) => setKategori(e.target.value as DokumentKategori)}
              className={inputKlasse}
            >
              {DOKUMENT_KATEGORIER.map((k) => (
                <option key={k} value={k}>
                  {KATEGORI_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelKlasse}>Navn</label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              className={inputKlasse}
              placeholder="Valgfritt – bruker filnavn hvis tomt"
            />
          </div>
          <div>
            <label className={labelKlasse}>Fil *</label>
            <input
              type="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
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
          {laster ? "Laster opp..." : "Last opp dokument"}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
        <div>
          <label className={labelKlasse}>Filtrer på kategori</label>
          <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)} className={inputKlasse}>
            <option value={FILTER_ALLE}>Alle kategorier</option>
            {DOKUMENT_KATEGORIER.map((k) => (
              <option key={k} value={k}>
                {KATEGORI_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelKlasse}>Filtrer på delprosjekt</label>
          <select
            value={delprosjektFilter}
            onChange={(e) => setDelprosjektFilter(e.target.value)}
            className={inputKlasse}
          >
            <option value={FILTER_ALLE}>Alle delprosjekter</option>
            <option value={FILTER_INGEN_DELPROSJEKT}>Ingen (eiendom)</option>
            {delprosjekter.map((d) => (
              <option key={d.id} value={d.id}>
                {d.navn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sletteFeil && <p className="text-red-600 text-sm">{sletteFeil}</p>}

      {dokumenterFiltrert.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Ingen dokumenter registrert.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {dokumenterFiltrert.map((d) => (
            <li key={d.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {d.navn}{" "}
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {kategoriLabel(d.kategori)}
                  </span>
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formaterDatoNorsk(d.opprettet)} – {d.delprosjektNavn ?? "Eiendom"} – {d.opplastetAvNavn} –{" "}
                  {formaterStorrelse(d.storrelse)}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <a href={`/api/dokumenter/${d.id}`} className="text-sm text-[var(--primary)] hover:underline">
                  Last ned
                </a>
                <button
                  type="button"
                  onClick={() => handleSlett(d.id)}
                  disabled={slettendeId === d.id}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {slettendeId === d.id ? "Sletter..." : "Slett"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
