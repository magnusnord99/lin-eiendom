"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface BoligData {
  id?: number;
  tittel: string;
  adresse: string;
  by: string;
  pris: string;
  type: string;
  storrelse: string;
  rom: string;
  bad: string;
  beskrivelse: string;
  bilder: string[];
  lat: string;
  lng: string;
  aktiv: boolean;
}

interface BoligSkjemaProps {
  initial?: Partial<BoligData> & { id?: number };
}

export default function BoligSkjema({ initial }: BoligSkjemaProps) {
  const router = useRouter();
  const [form, setForm] = useState<BoligData>({
    tittel: initial?.tittel ?? "",
    adresse: initial?.adresse ?? "",
    by: initial?.by ?? "",
    pris: initial?.pris?.toString() ?? "",
    type: initial?.type ?? "salg",
    storrelse: initial?.storrelse?.toString() ?? "",
    rom: initial?.rom?.toString() ?? "",
    bad: initial?.bad?.toString() ?? "",
    beskrivelse: initial?.beskrivelse ?? "",
    bilder: initial?.bilder ?? [],
    lat: initial?.lat?.toString() ?? "",
    lng: initial?.lng?.toString() ?? "",
    aktiv: initial?.aktiv ?? true,
  });

  const [laster, setLaster] = useState(false);
  const [lasterBilde, setLasterBilde] = useState(false);
  const [feil, setFeil] = useState("");
  const [slettBekreft, setSlettBekreft] = useState(false);

  function oppdater(felt: keyof BoligData, verdi: string | boolean) {
    setForm((f) => ({ ...f, [felt]: verdi }));
  }

  async function lastOppBilde(e: React.ChangeEvent<HTMLInputElement>) {
    const filer = e.target.files;
    if (!filer || filer.length === 0) return;

    setLasterBilde(true);
    const urls: string[] = [];

    for (const fil of Array.from(filer)) {
      const formData = new FormData();
      formData.append("file", fil);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        urls.push(data.url);
      }
    }

    setForm((f) => ({ ...f, bilder: [...f.bilder, ...urls] }));
    setLasterBilde(false);
    e.target.value = "";
  }

  function fjernBilde(index: number) {
    setForm((f) => ({ ...f, bilder: f.bilder.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    const payload = {
      tittel: form.tittel,
      adresse: form.adresse,
      by: form.by,
      pris: form.pris ? parseInt(form.pris) : null,
      type: form.type,
      storrelse: form.storrelse ? parseInt(form.storrelse) : null,
      rom: form.rom ? parseInt(form.rom) : null,
      bad: form.bad ? parseInt(form.bad) : null,
      beskrivelse: form.beskrivelse,
      bilder: JSON.stringify(form.bilder),
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      aktiv: form.aktiv,
    };

    const url = initial?.id ? `/api/boliger/${initial.id}` : "/api/boliger";
    const method = initial?.id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      router.push("/admin/boliger");
      router.refresh();
    } else {
      setFeil("Noe gikk galt. Prøv igjen.");
    }
    setLaster(false);
  }

  async function handleSlett() {
    if (!initial?.id) return;
    const res = await fetch(`/api/boliger/${initial.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/boliger");
      router.refresh();
    }
  }

  const inputKlasse = "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Grunninfo */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Grunnleggende info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelKlasse}>Tittel *</label>
            <input type="text" required value={form.tittel} onChange={(e) => oppdater("tittel", e.target.value)} className={inputKlasse} placeholder="f.eks. Lys og romslig 3-roms leilighet" />
          </div>
          <div>
            <label className={labelKlasse}>Adresse *</label>
            <input type="text" required value={form.adresse} onChange={(e) => oppdater("adresse", e.target.value)} className={inputKlasse} placeholder="Gatenavn 1" />
          </div>
          <div>
            <label className={labelKlasse}>By *</label>
            <input type="text" required value={form.by} onChange={(e) => oppdater("by", e.target.value)} className={inputKlasse} placeholder="Oslo" />
          </div>
          <div>
            <label className={labelKlasse}>Type *</label>
            <select value={form.type} onChange={(e) => oppdater("type", e.target.value)} className={inputKlasse}>
              <option value="salg">Til salgs</option>
              <option value="leie">Til leie</option>
            </select>
          </div>
          <div>
            <label className={labelKlasse}>Pris {form.type === "leie" ? "(kr/mnd)" : "(kr)"}</label>
            <input type="number" value={form.pris} onChange={(e) => oppdater("pris", e.target.value)} className={inputKlasse} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Detaljer */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Detaljer</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelKlasse}>Størrelse (m²)</label>
            <input type="number" value={form.storrelse} onChange={(e) => oppdater("storrelse", e.target.value)} className={inputKlasse} placeholder="0" />
          </div>
          <div>
            <label className={labelKlasse}>Antall rom</label>
            <input type="number" value={form.rom} onChange={(e) => oppdater("rom", e.target.value)} className={inputKlasse} placeholder="0" />
          </div>
          <div>
            <label className={labelKlasse}>Antall bad</label>
            <input type="number" value={form.bad} onChange={(e) => oppdater("bad", e.target.value)} className={inputKlasse} placeholder="0" />
          </div>
          <div className="md:col-span-3">
            <label className={labelKlasse}>Beskrivelse *</label>
            <textarea required value={form.beskrivelse} onChange={(e) => oppdater("beskrivelse", e.target.value)} rows={5} className={inputKlasse + " resize-none"} placeholder="Beskriv boligen..." />
          </div>
        </div>
      </div>

      {/* Bilder */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Bilder</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
          {form.bilder.map((bilde, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] group">
              <Image src={bilde} alt={`Bilde ${i + 1}`} fill className="object-cover" />
              <button
                type="button"
                onClick={() => fjernBilde(i)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
              >
                Fjern
              </button>
            </div>
          ))}
          <label className="aspect-square rounded-lg border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--surface)] transition-colors">
            <input type="file" accept="image/*" multiple className="hidden" onChange={lastOppBilde} disabled={lasterBilde} />
            {lasterBilde ? (
              <span className="text-xs text-[var(--muted)]">Laster...</span>
            ) : (
              <>
                <svg className="w-6 h-6 text-[var(--muted)] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs text-[var(--muted)]">Last opp</span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Kart */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-2">Koordinater (valgfritt)</h2>
        <p className="text-xs text-[var(--muted)] mb-5">Finn koordinater på maps.google.com eller openstreetmap.org</p>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelKlasse}>Breddegrad (lat)</label>
            <input type="number" step="any" value={form.lat} onChange={(e) => oppdater("lat", e.target.value)} className={inputKlasse} placeholder="59.9139" />
          </div>
          <div>
            <label className={labelKlasse}>Lengdegrad (lng)</label>
            <input type="number" step="any" value={form.lng} onChange={(e) => oppdater("lng", e.target.value)} className={inputKlasse} placeholder="10.7522" />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.aktiv} onChange={(e) => oppdater("aktiv", e.target.checked)} className="w-4 h-4 rounded border-[var(--border)] accent-[var(--primary)]" />
          <div>
            <span className="font-medium text-sm text-[var(--foreground)]">Aktiv annonse</span>
            <p className="text-xs text-[var(--muted)]">Skjul annonsen ved å fjerne haken</p>
          </div>
        </label>
      </div>

      {feil && <p className="text-red-600 text-sm">{feil}</p>}

      {/* Handlinger */}
      <div className="flex items-center justify-between">
        <div>
          {initial?.id && (
            <>
              {slettBekreft ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-600">Er du sikker?</span>
                  <button type="button" onClick={handleSlett} className="text-sm text-red-600 font-medium hover:underline">
                    Ja, slett
                  </button>
                  <button type="button" onClick={() => setSlettBekreft(false)} className="text-sm text-[var(--muted)] hover:underline">
                    Avbryt
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setSlettBekreft(true)} className="text-sm text-red-500 hover:text-red-700 transition-colors">
                  Slett bolig
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={laster}
            className="px-6 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
          >
            {laster ? "Lagrer..." : initial?.id ? "Oppdater bolig" : "Opprett bolig"}
          </button>
        </div>
      </div>
    </form>
  );
}
