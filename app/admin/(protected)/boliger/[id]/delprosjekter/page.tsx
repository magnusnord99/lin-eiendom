import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hentTimerForEiendom } from "@/lib/timeregistrering";
import { hentUtgifterForEiendom, beregnFaktiskPerDelprosjekt } from "@/lib/utgift";
import NyttDelprosjektSkjema from "./NyttDelprosjektSkjema";
import TimeregistreringPanel from "./TimeregistreringPanel";
import UtgiftPanel from "./UtgiftPanel";

export const dynamic = "force-dynamic";

export default async function DelprosjekterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eiendomId = parseInt(id);

  const eiendom = await prisma.bolig.findUnique({
    where: { id: eiendomId },
    include: { delprosjekter: { orderBy: { opprettet: "desc" } } },
  });

  if (!eiendom) notFound();

  const session = await getServerSession(authOptions);
  const naavarendeBrukerId = Number(session?.user?.id);
  const timerRader = await hentTimerForEiendom(prisma, eiendomId);
  const timer = timerRader.map((t) => ({
    id: t.id,
    dato: t.dato.toISOString().slice(0, 10),
    antallTimer: t.antallTimer,
    beskrivelse: t.beskrivelse,
    delprosjektNavn: t.delprosjektNavn,
    brukerId: t.brukerId,
    brukerNavn: t.brukerNavn,
  }));

  const eiere = await prisma.adminUser.findMany({
    where: { rolle: "eier" },
    select: { id: true, navn: true },
    orderBy: { navn: "asc" },
  });
  const utgiftRader = await hentUtgifterForEiendom(prisma, eiendomId);
  const utgifter = utgiftRader.map((u) => ({
    id: u.id,
    dato: u.dato.toISOString().slice(0, 10),
    kategori: u.kategori,
    beskrivelse: u.beskrivelse,
    leverandor: u.leverandor,
    belop: u.belop,
    harKvittering: u.harKvittering,
    delprosjektId: u.delprosjektId,
    delprosjektNavn: u.delprosjektNavn,
    betaltAvBrukerId: u.betaltAvBrukerId,
    betaltAvNavn: u.betaltAvNavn,
  }));
  const faktiskMap = await beregnFaktiskPerDelprosjekt(prisma, eiendomId);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/admin/boliger/${eiendomId}`} className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Delprosjekter – {eiendom.tittel}</h1>
        <span className="text-[var(--muted)]">/</span>
        <Link href={`/admin/boliger/${eiendomId}/kapital`} className="text-sm text-[var(--primary)] hover:underline">
          Kapital
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Nytt delprosjekt</h2>
        <NyttDelprosjektSkjema eiendomId={eiendomId} />
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Eksisterende delprosjekter</h2>
        {eiendom.delprosjekter.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Ingen delprosjekter registrert.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {eiendom.delprosjekter.map((d) => {
              const faktisk = faktiskMap.get(d.id) ?? 0;
              return (
                <li key={d.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--foreground)]">{d.navn}</p>
                    <p className="text-xs text-[var(--muted)]">{d.status}</p>
                  </div>
                  <p className="text-sm text-[var(--foreground)]">
                    {d.budsjett != null
                      ? `${new Intl.NumberFormat("nb-NO").format(faktisk)} / ${new Intl.NumberFormat("nb-NO").format(d.budsjett)} kr`
                      : "–"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mt-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Timeregistrering</h2>
        <TimeregistreringPanel
          eiendomId={eiendomId}
          delprosjekter={eiendom.delprosjekter.map((d) => ({ id: d.id, navn: d.navn }))}
          timer={timer}
          naavarendeBrukerId={naavarendeBrukerId}
        />
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mt-8">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Utgifter</h2>
        <UtgiftPanel
          eiendomId={eiendomId}
          delprosjekter={eiendom.delprosjekter.map((d) => ({ id: d.id, navn: d.navn }))}
          eiere={eiere.map((e) => ({ id: e.id, navn: e.navn }))}
          utgifter={utgifter}
        />
      </div>
    </div>
  );
}
