import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hentTilgjengelighetForPeriode, tellLedigePerDag } from "@/lib/tilgjengelighet";
import { hentArbeidshendelserForPeriode } from "@/lib/arbeidshendelse";
import KalenderGrid from "./KalenderGrid";

export const dynamic = "force-dynamic";

// Same idiom as `dagensDatoOslo()` in TimeregistreringPanel.tsx/UtgiftPanel.tsx/KapitalPanel.tsx
// and the Dokumenter page: the Oslo calendar date, used as a fallback when the
// `?dato=` search param is missing or invalid.
function dagensDatoOslo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
}

// Same validation idiom as `registrerTimerAction`/`registrerUtgiftAction` (and this
// feature's own `settTilgjengelighetAction`/`opprettArbeidshendelseAction`): a regex
// format check alone would accept `2026-13-01` or `2026-02-31` syntactically, so an
// exact round-trip through `Date` (which normalizes out-of-range months/days into a
// *different* calendar date) is what actually catches those.
function erGyldigDatoStreng(verdi: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verdi)) {
    return false;
  }
  const dato = new Date(`${verdi}T00:00:00.000Z`);
  return !Number.isNaN(dato.getTime()) && dato.toISOString().slice(0, 10) === verdi;
}

// `Tilgjengelighet.dato`/`Arbeidshendelse.dato` are plain user-entered dates stored as
// midnight-UTC (same convention as `Utgift.dato` etc. — see the Dokumenter page's note
// on why that's *not* true of real timestamps like `Dokument.opprettet`), so truncating
// the ISO string is the correct, timezone-safe way back to the `YYYY-MM-DD` key.
function tilDatoNokkel(dato: Date): string {
  return dato.toISOString().slice(0, 10);
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const datoParam = params.dato;

  // A repeated `?dato=` query param arrives as an array — treat that as invalid,
  // same as any other validation failure, and fall back to today.
  const anker =
    typeof datoParam === "string" && erGyldigDatoStreng(datoParam) ? datoParam : dagensDatoOslo();

  const [aar, maaned] = anker.split("-").map(Number);

  // The anchor's month is always what gets fetched/displayed — there is no separate
  // `?maned=` param (see plan review notes).
  const manedStart = new Date(Date.UTC(aar, maaned - 1, 1));
  const manedSlutt = new Date(Date.UTC(aar, maaned, 0)); // day 0 of next month = last day of this month

  // Pad to full Monday-start weeks (Norwegian convention). getUTCDay() is 0=Sun..6=Sat;
  // shifting by +6 mod 7 remaps it to 0=Mon..6=Sun.
  const startUkedag = (manedStart.getUTCDay() + 6) % 7;
  const sluttUkedag = (manedSlutt.getUTCDay() + 6) % 7;

  const gridStart = new Date(manedStart);
  gridStart.setUTCDate(gridStart.getUTCDate() - startUkedag);

  const gridSlutt = new Date(manedSlutt);
  gridSlutt.setUTCDate(gridSlutt.getUTCDate() + (6 - sluttUkedag));

  // Since the anchor always falls inside [manedStart, manedSlutt] and the padding only
  // extends outward to whole weeks, the anchor's own Mon–Sun week is always a subset of
  // this range — which is what makes the week-view toggle a safe pure client-side re-slice.
  const gridDatoer: string[] = [];
  for (const d = new Date(gridStart); d <= gridSlutt; d.setUTCDate(d.getUTCDate() + 1)) {
    gridDatoer.push(tilDatoNokkel(d));
  }

  const [session, tilgjengelighetRader, arbeidshendelseRader, eiere, boliger] = await Promise.all([
    getServerSession(authOptions),
    hentTilgjengelighetForPeriode(prisma, gridStart, gridSlutt),
    hentArbeidshendelserForPeriode(prisma, gridStart, gridSlutt),
    // `AdminUser` also has a `passord` column (bcrypt hash) — the explicit `select` is
    // mandatory so it never reaches this Server Component's serialized client props.
    prisma.adminUser.findMany({
      where: { rolle: "eier" },
      orderBy: { navn: "asc" },
      select: { id: true, navn: true },
    }),
    prisma.bolig.findMany({ orderBy: { tittel: "asc" }, select: { id: true, tittel: true } }),
  ]);

  const tilgjengelighet = tilgjengelighetRader.map((rad) => ({
    id: rad.id,
    brukerId: rad.brukerId,
    brukerNavn: rad.brukerNavn,
    dato: tilDatoNokkel(rad.dato),
    status: rad.status,
    fraKl: rad.fraKl,
    tilKl: rad.tilKl,
  }));

  const arbeidshendelser = arbeidshendelseRader.map((rad) => ({
    id: rad.id,
    eiendomId: rad.eiendomId,
    eiendomTittel: rad.eiendomTittel,
    tittel: rad.tittel,
    beskrivelse: rad.beskrivelse,
    dato: tilDatoNokkel(rad.dato),
    fraKl: rad.fraKl,
    tilKl: rad.tilKl,
  }));

  const ledigTelling = tellLedigePerDag(
    tilgjengelighet.map((rad) => ({ dato: rad.dato, status: rad.status }))
  );

  const naavaerendeBrukerId = session?.user?.id ? Number(session.user.id) : null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)] mb-6">Kalender</h1>
      <KalenderGrid
        anker={anker}
        gridDatoer={gridDatoer}
        eiere={eiere}
        boliger={boliger}
        tilgjengelighet={tilgjengelighet}
        arbeidshendelser={arbeidshendelser}
        ledigTelling={ledigTelling}
        naavaerendeBrukerId={naavaerendeBrukerId}
      />
    </div>
  );
}
