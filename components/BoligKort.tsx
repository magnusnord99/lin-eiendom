import Link from "next/link";
import Image from "next/image";

interface BoligKortProps {
  id: number;
  tittel: string;
  adresse: string;
  by: string;
  pris?: number | null;
  type: string;
  storrelse?: number | null;
  rom?: number | null;
  bilder: string;
}

function formatPris(pris: number, type: string) {
  const formatted = new Intl.NumberFormat("nb-NO").format(pris);
  if (type === "leie") return `${formatted} kr/mnd`;
  return `${formatted} kr`;
}

export default function BoligKort({ id, tittel, adresse, by, pris, type, storrelse, rom, bilder }: BoligKortProps) {
  let bildeListe: string[] = [];
  try {
    bildeListe = JSON.parse(bilder);
  } catch {}

  const href = `/${type}/${id}`;

  return (
    <Link href={href} className="group block bg-white rounded-xl overflow-hidden border border-[var(--border)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Bilde */}
      <div className="aspect-[4/3] bg-[var(--surface)] relative overflow-hidden">
        {bildeListe.length > 0 ? (
          <Image
            src={bildeListe[0]}
            alt={tittel}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
        )}
        {/* Tag */}
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            type === "salg"
              ? "bg-[var(--primary)] text-white"
              : "bg-[var(--secondary)] text-white"
          }`}>
            {type === "salg" ? "Til salgs" : "Til leie"}
          </span>
        </div>
      </div>

      {/* Innhold */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--foreground)] text-base mb-1 truncate group-hover:text-[var(--primary)] transition-colors">
          {tittel}
        </h3>
        <p className="text-[var(--muted)] text-sm mb-3">
          {adresse}, {by}
        </p>

        <div className="flex items-center justify-between">
          {pris ? (
            <span className="font-bold text-[var(--primary)] text-base">
              {formatPris(pris, type)}
            </span>
          ) : (
            <span className="text-[var(--muted)] text-sm">Pris på forespørsel</span>
          )}

          <div className="flex items-center gap-3 text-[var(--muted)] text-sm">
            {storrelse && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                {storrelse} m²
              </span>
            )}
            {rom && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {rom} rom
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
