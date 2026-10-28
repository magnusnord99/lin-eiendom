import { prisma } from "@/lib/prisma";
import { erOffentligSynlig, statusLabel, OFFENTLIG_SYNLIGE_STATUSER } from "@/lib/eiendom-status";
import {
  hentTotalInvestert,
  hentTotalUtgifterDenneManeden,
  hentEiendomOversikt,
} from "@/lib/dashboard";
import { hentKommendeArbeidshendelser } from "@/lib/arbeidshendelse";
import Link from "next/link";

export const dynamic = "force-dynamic";

const nok = new Intl.NumberFormat("nb-NO");

// Same idiom as `dagensDatoOslo()` in kalender/page.tsx, KapitalPanel.tsx,
// TimeregistreringPanel.tsx og UtgiftPanel.tsx: Oslo-kalenderdatoen, ikke UTC-datoen,
// avgjør hva "i dag" betyr, men lagrede `dato`-felt er UTC-midnatt.
function dagensDatoOsloSomUtcMidnatt(): Date {
  const datoNokkel = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" }).format(new Date());
  return new Date(`${datoNokkel}T00:00:00.000Z`);
}

function formaterNorskDato(dato: Date): string {
  const dag = String(dato.getUTCDate()).padStart(2, "0");
  const maned = String(dato.getUTCMonth() + 1).padStart(2, "0");
  const aar = dato.getUTCFullYear();
  return `${dag}.${maned}.${aar}`;
}

export default async function AdminDashboard() {
  const [totalt, salg, leie, synligOffentlig, totalInvestert, totalUtgifterDenneManeden] = await Promise.all([
    prisma.bolig.count(),
    prisma.bolig.count({ where: { type: "salg" } }),
    prisma.bolig.count({ where: { type: "leie" } }),
    prisma.bolig.count({ where: { status: { in: OFFENTLIG_SYNLIGE_STATUSER } } }),
    hentTotalInvestert(prisma),
    hentTotalUtgifterDenneManeden(prisma),
  ]);

  const eiendomOversikt = await hentEiendomOversikt(prisma);
  const kommendeArbeidshendelser = await hentKommendeArbeidshendelser(
    prisma,
    dagensDatoOsloSomUtcMidnatt(),
    5
  );

  const sisteeBoliger = await prisma.bolig.findMany({
    orderBy: { opprettet: "desc" },
    take: 5,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Dashboard</h1>
        <Link
          href="/admin/boliger/ny"
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--primary-light)] transition-colors"
        >
          + Ny bolig
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {[
          { label: "Totalt boliger", verdi: totalt, farge: "text-[var(--foreground)]" },
          { label: "Til salgs", verdi: salg, farge: "text-[var(--primary)]" },
          { label: "Til leie", verdi: leie, farge: "text-[var(--secondary)]" },
          { label: "Synlig offentlig", verdi: synligOffentlig, farge: "text-green-600" },
          { label: "Totalt investert", verdi: `${nok.format(totalInvestert)} kr`, farge: "text-[var(--foreground)]" },
          { label: "Utgifter denne måneden", verdi: `${nok.format(totalUtgifterDenneManeden)} kr`, farge: "text-[var(--foreground)]" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-[var(--border)] p-6">
            <p className="text-[var(--muted)] text-sm mb-1">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.farge}`}>{stat.verdi}</p>
          </div>
        ))}
      </div>

      {/* Siste boliger */}
      <div className="bg-white rounded-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Siste boliger</h2>
          <Link href="/admin/boliger" className="text-[var(--primary)] text-sm hover:underline">
            Se alle
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {sisteeBoliger.map((bolig) => (
            <div key={bolig.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-medium text-sm text-[var(--foreground)]">{bolig.tittel}</p>
                <p className="text-xs text-[var(--muted)]">{bolig.adresse}, {bolig.by}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  bolig.type === "salg"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-cyan-100 text-cyan-700"
                }`}>
                  {bolig.type === "salg" ? "Salg" : "Leie"}
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  erOffentligSynlig(bolig.status) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {statusLabel(bolig.status)}
                </span>
                <Link
                  href={`/admin/boliger/${bolig.id}`}
                  className="text-[var(--primary)] text-xs hover:underline"
                >
                  Rediger
                </Link>
              </div>
            </div>
          ))}
          {sisteeBoliger.length === 0 && (
            <div className="px-6 py-10 text-center text-[var(--muted)] text-sm">
              Ingen boliger ennå.{" "}
              <Link href="/admin/boliger/ny" className="text-[var(--primary)] hover:underline">
                Opprett den første!
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Budsjett og utgifter per eiendom */}
      <div className="bg-white rounded-xl border border-[var(--border)] mt-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Budsjett og utgifter per eiendom</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {eiendomOversikt.map((eiendom) => (
            <div key={eiendom.id} className="flex items-center justify-between px-6 py-4">
              <Link
                href={`/admin/boliger/${eiendom.id}`}
                className="font-medium text-sm text-[var(--foreground)] hover:underline"
              >
                {eiendom.tittel}
              </Link>
              <div className="text-sm text-[var(--foreground)] text-right">
                <p>{nok.format(eiendom.totalUtgift)} kr</p>
                <p className="text-xs text-[var(--muted)]">
                  {eiendom.antallMedBudsjett === 0 ? (
                    "Ikke budsjettert"
                  ) : (
                    <>
                      {nok.format(eiendom.totalBudsjett)} kr budsjettert
                      {eiendom.antallMedBudsjett < eiendom.antallDelprosjekter && (
                        <span className="text-[var(--muted)]"> (delvis)</span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
          ))}
          {eiendomOversikt.length === 0 && (
            <div className="px-6 py-10 text-center text-[var(--muted)] text-sm">
              Ingen boliger ennå.{" "}
              <Link href="/admin/boliger/ny" className="text-[var(--primary)] hover:underline">
                Opprett den første!
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Kommende arbeidshendelser */}
      <div className="bg-white rounded-xl border border-[var(--border)] mt-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--foreground)]">Kommende arbeidshendelser</h2>
          <Link href="/admin/kalender" className="text-[var(--primary)] text-sm hover:underline">
            Se kalenderen
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {kommendeArbeidshendelser.map((hendelse) => (
            <div key={hendelse.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-medium text-sm text-[var(--foreground)]">{hendelse.tittel}</p>
                <Link
                  href={`/admin/boliger/${hendelse.eiendomId}`}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  {hendelse.eiendomTittel}
                </Link>
              </div>
              <p className="text-sm text-[var(--muted)]">{formaterNorskDato(hendelse.dato)}</p>
            </div>
          ))}
          {kommendeArbeidshendelser.length === 0 && (
            <div className="px-6 py-10 text-center text-[var(--muted)] text-sm">
              Ingen kommende arbeidshendelser.{" "}
              <Link href="/admin/kalender" className="text-[var(--primary)] hover:underline">
                Se kalenderen!
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
