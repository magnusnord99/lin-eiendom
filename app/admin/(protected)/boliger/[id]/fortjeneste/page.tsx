import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { beregnFortjenestefordeling } from "@/lib/fortjeneste";

export const dynamic = "force-dynamic";

function formatKr(verdi: number): string {
  return `${new Intl.NumberFormat("nb-NO").format(Math.round(verdi))} kr`;
}

export default async function FortjenestePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eiendomId = parseInt(id);

  const eiendom = await prisma.bolig.findUnique({ where: { id: eiendomId } });

  if (!eiendom) notFound();

  const resultat = await beregnFortjenestefordeling(prisma, eiendomId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/boliger/${eiendomId}`} className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Fortjeneste – {eiendom.tittel}</h1>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/delprosjekter`} className="text-sm text-[var(--primary)] hover:underline">
          Delprosjekter
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/kapital`} className="text-sm text-[var(--primary)] hover:underline">
          Kapital
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <Link href="/admin/innstillinger" className="text-sm text-[var(--primary)] hover:underline">
          Juster fordelingsnøkkel
        </Link>
      </div>

      {!resultat.beregnet ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-6">
          <p className="text-sm text-[var(--muted)]">{resultat.grunn}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
            <h2 className="font-semibold text-[var(--foreground)] mb-5">Oppsummering</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Kjøpesum</p>
                <p className="text-sm font-medium text-[var(--foreground)]">{formatKr(resultat.kjopesum)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Salgssum</p>
                <p className="text-sm font-medium text-[var(--foreground)]">{formatKr(resultat.salgssum)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Totale utgifter</p>
                <p className="text-sm font-medium text-[var(--foreground)]">{formatKr(resultat.totalUtgifter)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)] mb-1">Fortjeneste</p>
                <p className="text-lg font-bold text-[var(--foreground)]">{formatKr(resultat.fortjeneste)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
            <h2 className="font-semibold text-[var(--foreground)] mb-3">Fordelingsnøkkel</h2>
            <p className="text-sm text-[var(--foreground)]">
              Fordeling: {resultat.likedelProsent} % likt, {resultat.arbeidstimerAndelProsent} % etter arbeidstimer,{" "}
              {resultat.kapitalAndelProsent} % etter kapital
            </p>
            {resultat.arbeidstimerFallbackBrukt && (
              <p className="text-xs text-[var(--muted)] mt-1">Ingen timer registrert — fordelt likt.</p>
            )}
            {resultat.kapitalFallbackBrukt && (
              <p className="text-xs text-[var(--muted)] mt-1">Ingen kapitalinnskudd registrert — fordelt likt.</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[var(--border)] p-6">
            <h2 className="font-semibold text-[var(--foreground)] mb-5">Fordeling per eier</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted)] text-xs border-b border-[var(--border)]">
                    <th className="py-2 pr-4">Eier</th>
                    <th className="py-2 pr-4">Arbeidsandel</th>
                    <th className="py-2 pr-4">Kapitalandel</th>
                    <th className="py-2 pr-4">Likedel</th>
                    <th className="py-2 pr-4">Arbeidsdel</th>
                    <th className="py-2 pr-4">Kapitaldel</th>
                    <th className="py-2">Totalt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {resultat.perEier.map((rad) => (
                    <tr key={rad.brukerId}>
                      <td className="py-3 pr-4 font-medium text-[var(--foreground)]">{rad.brukerNavn}</td>
                      <td className="py-3 pr-4 text-[var(--foreground)]">{rad.arbeidsandelProsent.toFixed(1)} %</td>
                      <td className="py-3 pr-4 text-[var(--foreground)]">{rad.kapitalandelProsent.toFixed(1)} %</td>
                      <td className="py-3 pr-4 text-[var(--foreground)]">{formatKr(rad.likedel)}</td>
                      <td className="py-3 pr-4 text-[var(--foreground)]">{formatKr(rad.arbeidsdel)}</td>
                      <td className="py-3 pr-4 text-[var(--foreground)]">{formatKr(rad.kapitaldel)}</td>
                      <td className="py-3 font-semibold text-[var(--foreground)]">{formatKr(rad.totalt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)] mt-4">Avrundet til nærmeste kr.</p>
          </div>
        </>
      )}
    </div>
  );
}
