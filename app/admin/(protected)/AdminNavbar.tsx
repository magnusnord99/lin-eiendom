"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function AdminNavbar() {
  const pathname = usePathname();

  return (
    <header className="bg-[var(--primary)] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold text-sm">
              Yappuccino Admin
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === "/admin" ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/boliger"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname.startsWith("/admin/boliger") ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                Boliger
              </Link>
              <Link
                href="/admin/henvendelser"
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname.startsWith("/admin/henvendelser") ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                Henvendelser
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" target="_blank" className="text-white/70 text-sm hover:text-white">
              Se nettside ↗
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/admin/innlogging" })}
              className="text-white/70 text-sm hover:text-white transition-colors"
            >
              Logg ut
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
