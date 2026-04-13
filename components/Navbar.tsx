"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/boliger", label: "Boliger" },
  { href: "/selg-til-oss", label: "Selg til oss" },
  { href: "/om-oss", label: "Om oss" },
  { href: "/kontakt", label: "Kontakt" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-[var(--border)] sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[var(--primary)] rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-lg leading-none">Y</span>
            </div>
            <span className="font-semibold text-[var(--primary)] text-lg tracking-tight">
              Yappuccino <span className="font-light">AS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-[var(--surface)] text-[var(--primary)]"
                    : "text-gray-600 hover:text-[var(--primary)] hover:bg-[var(--surface)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:block">
            <Link
              href="/selg-til-oss"
              className="bg-[var(--primary)] text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-[var(--primary-light)] transition-colors"
            >
              Selg til oss
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-[var(--surface)]"
            onClick={() => setOpen(!open)}
            aria-label="Åpne meny"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 border-t border-[var(--border)] mt-2 pt-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 rounded-md text-sm font-medium ${
                  pathname === link.href
                    ? "bg-[var(--surface)] text-[var(--primary)]"
                    : "text-gray-600 hover:bg-[var(--surface)]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/selg-til-oss"
              onClick={() => setOpen(false)}
              className="block mt-2 bg-[var(--primary)] text-white px-4 py-2 rounded-md text-sm font-medium text-center"
            >
              Selg til oss
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
