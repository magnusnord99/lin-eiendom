import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [totalt, salg, leie, aktive] = await Promise.all([
    prisma.bolig.count(),
    prisma.bolig.count({ where: { type: "salg" } }),
    prisma.bolig.count({ where: { type: "leie" } }),
    prisma.bolig.count({ where: { aktiv: true } }),
  ]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Totalt boliger", verdi: totalt, farge: "text-[var(--foreground)]" },
          { label: "Til salgs", verdi: salg, farge: "text-[var(--primary)]" },
          { label: "Til leie", verdi: leie, farge: "text-[var(--secondary)]" },
          { label: "Aktive", verdi: aktive, farge: "text-green-600" },
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
                  bolig.aktiv ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {bolig.aktiv ? "Aktiv" : "Inaktiv"}
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
    </div>
  );
}
