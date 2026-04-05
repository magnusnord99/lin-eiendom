import Link from "next/link";
import Image from "next/image";
import { Home, Maximize2, BedDouble } from "lucide-react";

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
            <Home className="w-10 h-10 text-gray-300" strokeWidth={1} />
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
                <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                {storrelse} m²
              </span>
            )}
            {rom && (
              <span className="flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" strokeWidth={1.5} />
                {rom} rom
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
