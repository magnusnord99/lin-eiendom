import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminBoliger() {
  const boliger = await prisma.bolig.findMany({ orderBy: { opprettet: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Alle boliger</h1>
        <Link
          href="/admin/boliger/ny"
          className="bg-[var(--primary)] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[var(--primary-light)] transition-colors"
        >
          + Ny bolig
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-[var(--muted)]">Bolig</th>
              <th className="text-left px-6 py-3 font-medium text-[var(--muted)]">Type</th>
              <th className="text-left px-6 py-3 font-medium text-[var(--muted)]">Pris</th>
              <th className="text-left px-6 py-3 font-medium text-[var(--muted)]">Status</th>
              <th className="text-right px-6 py-3 font-medium text-[var(--muted)]">Handlinger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {boliger.map((bolig) => (
              <tr key={bolig.id} className="hover:bg-[var(--surface)] transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-[var(--foreground)]">{bolig.tittel}</p>
                  <p className="text-xs text-[var(--muted)]">{bolig.adresse}, {bolig.by}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    bolig.type === "salg" ? "bg-blue-100 text-blue-700" : "bg-cyan-100 text-cyan-700"
                  }`}>
                    {bolig.type === "salg" ? "Salg" : "Leie"}
                  </span>
                </td>
                <td className="px-6 py-4 text-[var(--foreground)]">
                  {bolig.pris
                    ? new Intl.NumberFormat("nb-NO").format(bolig.pris) + (bolig.type === "leie" ? " kr/mnd" : " kr")
                    : "–"}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    bolig.aktiv ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {bolig.aktiv ? "Aktiv" : "Inaktiv"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/admin/boliger/${bolig.id}`}
                    className="text-[var(--primary)] hover:underline text-sm"
                  >
                    Rediger
                  </Link>
                </td>
              </tr>
            ))}
            {boliger.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[var(--muted)]">
                  Ingen boliger ennå.{" "}
                  <Link href="/admin/boliger/ny" className="text-[var(--primary)] hover:underline">
                    Legg til den første!
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
