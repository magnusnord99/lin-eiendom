import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--primary)] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-white/20 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">L</span>
              </div>
              <span className="font-semibold text-lg tracking-tight">
                LIN <span className="font-light">Eiendom</span>
              </span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Vi kjøper boliger som trenger renovering, pusser dem opp og selger
              eller leier dem ut. Karl Johns Veg 12.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-white/50">
              Navigasjon
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/boliger", label: "Våre boliger" },
                { href: "/selg-til-oss", label: "Selg til oss" },
                { href: "/om-oss", label: "Om oss" },
                { href: "/kontakt", label: "Kontakt" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/70 hover:text-white transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-white/50">
              Kontakt
            </h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li>post@lineiendom.no</li>
              <li>+47 22 33 44 55</li>
              <li>Karl Johns Veg 12</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-white/50">
          <p>© {new Date().getFullYear()} LIN Eiendom. Alle rettigheter forbeholdt.</p>
          <Link href="/admin" className="hover:text-white/80 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
