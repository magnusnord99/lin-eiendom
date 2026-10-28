"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  settTilgjengelighetAction,
  slettTilgjengelighetAction,
  opprettArbeidshendelseAction,
  slettArbeidshendelseAction,
} from "./actions";

type TilgjengelighetStatus = "ledig" | "ikke_ledig";

interface TilgjengelighetRad {
  id: number;
  brukerId: number;
  brukerNavn: string;
  dato: string;
  status: TilgjengelighetStatus;
  fraKl: string | null;
  tilKl: string | null;
}

interface ArbeidshendelseRad {
  id: number;
  eiendomId: number;
  eiendomTittel: string;
  tittel: string;
  beskrivelse: string | null;
  dato: string;
  fraKl: string | null;
  tilKl: string | null;
}

interface KalenderGridProps {
  anker: string;
  gridDatoer: string[];
  eiere: { id: number; navn: string }[];
  boliger: { id: number; tittel: string }[];
  tilgjengelighet: TilgjengelighetRad[];
  arbeidshendelser: ArbeidshendelseRad[];
  ledigTelling: Record<string, number>;
  naavaerendeBrukerId: number | null;
}

const MAKS_GJENTAKELSER = 26;

// Fixed, deterministic palette — color is `brukerId % PALETT.length`, no new
// model field needed to track a color per owner.
const PALETT = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

const UKEDAG_NAVN = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function paletteFarge(brukerId: number): string {
  return PALETT[((brukerId % PALETT.length) + PALETT.length) % PALETT.length];
}

function formaterDatoNorsk(iso: string): string {
  const [aar, maaned, dag] = iso.split("-");
  return `${dag}.${maaned}.${aar}`;
}

function manedNavn(iso: string): string {
  const [aarStr, manedStr] = iso.split("-");
  const d = new Date(Date.UTC(Number(aarStr), Number(manedStr) - 1, 1));
  return new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function leggTilDager(iso: string, dager: number): string {
  const [aar, maaned, dag] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(aar, maaned - 1, dag));
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

function forsteIManed(iso: string, delta: number): string {
  const [aar, maaned] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(aar, maaned - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

function erSammeManed(iso: string, anker: string): boolean {
  return iso.slice(0, 7) === anker.slice(0, 7);
}

export default function KalenderGrid({
  anker,
  gridDatoer,
  eiere,
  boliger,
  tilgjengelighet,
  arbeidshendelser,
  ledigTelling,
  naavaerendeBrukerId,
}: KalenderGridProps) {
  const router = useRouter();
  const [visning, setVisning] = useState<"maned" | "uke">("maned");
  const [valgtDato, setValgtDato] = useState<string | null>(null);

  const tilgjengelighetPerDag = useMemo(() => {
    const map = new Map<string, TilgjengelighetRad[]>();
    for (const rad of tilgjengelighet) {
      const liste = map.get(rad.dato) ?? [];
      liste.push(rad);
      map.set(rad.dato, liste);
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => a.brukerNavn.localeCompare(b.brukerNavn));
    }
    return map;
  }, [tilgjengelighet]);

  const arbeidshendelserPerDag = useMemo(() => {
    const map = new Map<string, ArbeidshendelseRad[]>();
    for (const rad of arbeidshendelser) {
      const liste = map.get(rad.dato) ?? [];
      liste.push(rad);
      map.set(rad.dato, liste);
    }
    return map;
  }, [arbeidshendelser]);

  // The padded grid is always chunked into whole Monday-start weeks, so slicing
  // it into groups of 7 and picking the chunk containing the anchor gives the
  // anchor's own week — a pure in-memory re-slice, never a second fetch.
  const ukeDatoer = useMemo(() => {
    for (let i = 0; i < gridDatoer.length; i += 7) {
      const uke = gridDatoer.slice(i, i + 7);
      if (uke.includes(anker)) {
        return uke;
      }
    }
    return gridDatoer.slice(0, 7);
  }, [gridDatoer, anker]);

  const synligeDatoer = visning === "uke" ? ukeDatoer : gridDatoer;

  const maksTelling = useMemo(() => {
    let maks = 0;
    for (const dato of synligeDatoer) {
      const antall = ledigTelling[dato] ?? 0;
      if (antall > maks) {
        maks = antall;
      }
    }
    return maks;
  }, [synligeDatoer, ledigTelling]);

  const ukeRader = useMemo(() => {
    const rader: string[][] = [];
    for (let i = 0; i < synligeDatoer.length; i += 7) {
      rader.push(synligeDatoer.slice(i, i + 7));
    }
    return rader;
  }, [synligeDatoer]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/kalender?dato=${forsteIManed(anker, -1)}`}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-gray-50"
          >
            ‹ Forrige måned
          </Link>
          <Link
            href="/admin/kalender"
            className="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-gray-50"
          >
            I dag
          </Link>
          <Link
            href={`/admin/kalender?dato=${forsteIManed(anker, 1)}`}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-gray-50"
          >
            Neste måned ›
          </Link>
          <span className="ml-2 font-semibold text-[var(--foreground)] capitalize">{manedNavn(anker)}</span>
        </div>

        <div className="flex items-center gap-2">
          {visning === "uke" && (
            <>
              <Link
                href={`/admin/kalender?dato=${leggTilDager(anker, -7)}`}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-gray-50"
              >
                ‹ Forrige uke
              </Link>
              <Link
                href={`/admin/kalender?dato=${leggTilDager(anker, 7)}`}
                className="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-gray-50"
              >
                Neste uke ›
              </Link>
            </>
          )}
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setVisning("maned")}
              className={`px-3 py-1.5 ${visning === "maned" ? "bg-[var(--primary)] text-white" : "bg-white hover:bg-gray-50"}`}
            >
              Måned
            </button>
            <button
              type="button"
              onClick={() => setVisning("uke")}
              className={`px-3 py-1.5 ${visning === "uke" ? "bg-[var(--primary)] text-white" : "bg-white hover:bg-gray-50"}`}
            >
              Uke
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--muted)]" /> Ledig (fylt)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[var(--muted)]" /> Ikke ledig (ring)
        </span>
        {eiere.map((eier) => (
          <span key={eier.id} className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: paletteFarge(eier.id) }}
            />
            {eier.navn}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-[var(--border)]">
          {UKEDAG_NAVN.map((navn) => (
            <div key={navn} className="px-2 py-2 text-xs font-medium text-[var(--muted)] text-center">
              {navn}
            </div>
          ))}
        </div>

        {ukeRader.map((uke, ukeIndex) => (
          <div key={ukeIndex} className="grid grid-cols-7 border-b border-[var(--border)] last:border-b-0">
            {uke.map((dato) => {
              const iManed = erSammeManed(dato, anker);
              const erAnker = dato === anker;
              const erValgt = dato === valgtDato;
              const antallLedig = ledigTelling[dato] ?? 0;
              const erMaksOverlapp = maksTelling > 0 && antallLedig === maksTelling;
              const tilgRader = tilgjengelighetPerDag.get(dato) ?? [];
              const hendelser = arbeidshendelserPerDag.get(dato) ?? [];
              const dag = Number(dato.slice(8, 10));

              return (
                <button
                  type="button"
                  key={dato}
                  onClick={() => setValgtDato(dato)}
                  className={`min-h-[6.5rem] p-1.5 text-left border-r border-[var(--border)] last:border-r-0 flex flex-col gap-1 transition-colors ${
                    erMaksOverlapp ? "bg-amber-50" : "bg-white hover:bg-gray-50"
                  } ${erValgt ? "ring-2 ring-[var(--primary)] ring-inset" : ""} ${!iManed ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${erAnker ? "font-bold text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                    >
                      {dag}
                    </span>
                    {antallLedig > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary)] text-white leading-none">
                        {antallLedig}
                      </span>
                    )}
                  </div>

                  {tilgRader.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {tilgRader.map((rad) => (
                        <span
                          key={rad.id}
                          title={`${rad.brukerNavn}: ${rad.status === "ledig" ? "Ledig" : "Ikke ledig"}`}
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={
                            rad.status === "ledig"
                              ? { backgroundColor: paletteFarge(rad.brukerId) }
                              : {
                                  backgroundColor: "transparent",
                                  border: `2px solid ${paletteFarge(rad.brukerId)}`,
                                }
                          }
                        />
                      ))}
                    </div>
                  )}

                  {hendelser.length > 0 && (
                    <div className="flex flex-col gap-0.5">
                      {hendelser.slice(0, 2).map((h) => (
                        <span
                          key={h.id}
                          className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-[var(--foreground)] truncate"
                          title={h.tittel}
                        >
                          {h.tittel}
                        </span>
                      ))}
                      {hendelser.length > 2 && (
                        <span className="text-[10px] text-[var(--muted)]">+{hendelser.length - 2} mer</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {valgtDato && (
        <DagDetaljer
          key={valgtDato}
          dato={valgtDato}
          onLukk={() => setValgtDato(null)}
          boliger={boliger}
          tilgjengelighetRader={tilgjengelighetPerDag.get(valgtDato) ?? []}
          arbeidshendelseRader={arbeidshendelserPerDag.get(valgtDato) ?? []}
          naavaerendeBrukerId={naavaerendeBrukerId}
          router={router}
        />
      )}
    </div>
  );
}

interface DagDetaljerProps {
  dato: string;
  onLukk: () => void;
  boliger: { id: number; tittel: string }[];
  tilgjengelighetRader: TilgjengelighetRad[];
  arbeidshendelseRader: ArbeidshendelseRad[];
  naavaerendeBrukerId: number | null;
  router: ReturnType<typeof useRouter>;
}

function DagDetaljer({
  dato,
  onLukk,
  boliger,
  tilgjengelighetRader,
  arbeidshendelseRader,
  naavaerendeBrukerId,
  router,
}: DagDetaljerProps) {
  const [status, setStatus] = useState<TilgjengelighetStatus>("ledig");
  const [fraKl, setFraKl] = useState("");
  const [tilKl, setTilKl] = useState("");
  const [gjentaUker, setGjentaUker] = useState("");
  const [tilgLaster, setTilgLaster] = useState(false);
  const [tilgFeil, setTilgFeil] = useState("");
  const [slettendeTilgId, setSlettendeTilgId] = useState<number | null>(null);

  const [eiendomId, setEiendomId] = useState(String(boliger[0]?.id ?? ""));
  const [tittel, setTittel] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [hendelseFraKl, setHendelseFraKl] = useState("");
  const [hendelseTilKl, setHendelseTilKl] = useState("");
  const [hendelseLaster, setHendelseLaster] = useState(false);
  const [hendelseFeil, setHendelseFeil] = useState("");
  const [slettendeHendelseId, setSlettendeHendelseId] = useState<number | null>(null);

  const inputKlasse =
    "w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent bg-white";
  const labelKlasse = "block text-sm font-medium text-[var(--foreground)] mb-1";

  async function handleSettTilgjengelighet(e: React.FormEvent) {
    e.preventDefault();
    setTilgLaster(true);
    setTilgFeil("");

    try {
      const resultat = await settTilgjengelighetAction({
        dato,
        status,
        fraKl: fraKl || undefined,
        tilKl: tilKl || undefined,
        gjentaUkerAntall: gjentaUker ? Number(gjentaUker) : undefined,
      });

      if (!resultat.ok) {
        setTilgFeil(resultat.feilmelding);
        return;
      }

      setFraKl("");
      setTilKl("");
      setGjentaUker("");
      router.refresh();
    } catch {
      setTilgFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setTilgLaster(false);
    }
  }

  async function handleSlettTilgjengelighet(id: number) {
    setSlettendeTilgId(id);
    setTilgFeil("");

    try {
      const resultat = await slettTilgjengelighetAction(id);
      if (resultat.ok) {
        router.refresh();
      } else {
        setTilgFeil(resultat.feilmelding);
      }
    } catch {
      setTilgFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setSlettendeTilgId(null);
    }
  }

  async function handleOpprettHendelse(e: React.FormEvent) {
    e.preventDefault();
    setHendelseLaster(true);
    setHendelseFeil("");

    try {
      const resultat = await opprettArbeidshendelseAction({
        eiendomId: Number(eiendomId),
        tittel,
        beskrivelse: beskrivelse || undefined,
        dato,
        fraKl: hendelseFraKl || undefined,
        tilKl: hendelseTilKl || undefined,
      });

      if (!resultat.ok) {
        setHendelseFeil(resultat.feilmelding);
        return;
      }

      setTittel("");
      setBeskrivelse("");
      setHendelseFraKl("");
      setHendelseTilKl("");
      router.refresh();
    } catch {
      setHendelseFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setHendelseLaster(false);
    }
  }

  async function handleSlettHendelse(id: number) {
    setSlettendeHendelseId(id);
    setHendelseFeil("");

    try {
      const resultat = await slettArbeidshendelseAction(id);
      if (resultat.ok) {
        router.refresh();
      } else {
        setHendelseFeil(resultat.feilmelding);
      }
    } catch {
      setHendelseFeil("Noe gikk galt. Prøv igjen.");
    } finally {
      setSlettendeHendelseId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[var(--foreground)]">{formaterDatoNorsk(dato)}</h2>
        <button type="button" onClick={onLukk} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Lukk ✕
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Tilgjengelighet</h3>

          {tilgjengelighetRader.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ingen registreringer denne dagen.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {tilgjengelighetRader.map((rad) => (
                <li key={rad.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={
                        rad.status === "ledig"
                          ? { backgroundColor: paletteFarge(rad.brukerId) }
                          : { backgroundColor: "transparent", border: `2px solid ${paletteFarge(rad.brukerId)}` }
                      }
                    />
                    <span className="font-medium text-[var(--foreground)]">{rad.brukerNavn}</span>
                    <span className="text-[var(--muted)]">
                      {rad.status === "ledig" ? "Ledig" : "Ikke ledig"} –{" "}
                      {rad.fraKl && rad.tilKl ? `${rad.fraKl}–${rad.tilKl}` : "hele dagen"}
                    </span>
                  </div>
                  {rad.brukerId === naavaerendeBrukerId && (
                    <button
                      type="button"
                      onClick={() => handleSlettTilgjengelighet(rad.id)}
                      disabled={slettendeTilgId === rad.id}
                      className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      {slettendeTilgId === rad.id ? "Sletter..." : "Slett"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleSettTilgjengelighet} className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="status"
                  checked={status === "ledig"}
                  onChange={() => setStatus("ledig")}
                />
                Ledig
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="status"
                  checked={status === "ikke_ledig"}
                  onChange={() => setStatus("ikke_ledig")}
                />
                Ikke ledig
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelKlasse}>Fra kl.</label>
                <input type="time" value={fraKl} onChange={(e) => setFraKl(e.target.value)} className={inputKlasse} />
              </div>
              <div>
                <label className={labelKlasse}>Til kl.</label>
                <input type="time" value={tilKl} onChange={(e) => setTilKl(e.target.value)} className={inputKlasse} />
              </div>
            </div>
            <div>
              <label className={labelKlasse}>Gjenta ukentlig i N uker</label>
              <input
                type="number"
                min="1"
                max={MAKS_GJENTAKELSER}
                value={gjentaUker}
                onChange={(e) => setGjentaUker(e.target.value)}
                className={inputKlasse}
                placeholder="Valgfritt (maks 26)"
              />
            </div>
            {tilgFeil && <p className="text-red-600 text-sm">{tilgFeil}</p>}
            <button
              type="submit"
              disabled={tilgLaster}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
            >
              {tilgLaster ? "Lagrer..." : "Registrer"}
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Arbeidshendelser</h3>

          {arbeidshendelseRader.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ingen arbeidshendelser denne dagen.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {arbeidshendelseRader.map((rad) => (
                <li key={rad.id} className="py-2 flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium text-[var(--foreground)]">
                      {rad.tittel} – {rad.eiendomTittel}
                    </p>
                    <p className="text-[var(--muted)]">
                      {rad.fraKl && rad.tilKl ? `${rad.fraKl}–${rad.tilKl}` : "hele dagen"}
                      {rad.beskrivelse ? ` – ${rad.beskrivelse}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSlettHendelse(rad.id)}
                    disabled={slettendeHendelseId === rad.id}
                    className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 shrink-0"
                  >
                    {slettendeHendelseId === rad.id ? "Sletter..." : "Slett"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleOpprettHendelse} className="space-y-3 border-t border-[var(--border)] pt-4">
            <div>
              <label className={labelKlasse}>Eiendom *</label>
              <select
                required
                value={eiendomId}
                onChange={(e) => setEiendomId(e.target.value)}
                className={inputKlasse}
              >
                {boliger.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.tittel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelKlasse}>Tittel *</label>
              <input
                type="text"
                required
                value={tittel}
                onChange={(e) => setTittel(e.target.value)}
                className={inputKlasse}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelKlasse}>Fra kl.</label>
                <input
                  type="time"
                  value={hendelseFraKl}
                  onChange={(e) => setHendelseFraKl(e.target.value)}
                  className={inputKlasse}
                />
              </div>
              <div>
                <label className={labelKlasse}>Til kl.</label>
                <input
                  type="time"
                  value={hendelseTilKl}
                  onChange={(e) => setHendelseTilKl(e.target.value)}
                  className={inputKlasse}
                />
              </div>
            </div>
            {hendelseFeil && <p className="text-red-600 text-sm">{hendelseFeil}</p>}
            <button
              type="submit"
              disabled={hendelseLaster || boliger.length === 0}
              className="px-4 py-2 bg-[var(--primary)] text-white rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
            >
              {hendelseLaster ? "Lagrer..." : "Registrer hendelse"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
