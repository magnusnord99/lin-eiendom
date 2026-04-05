import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BoligGalleri from "@/components/BoligGalleri";
import KontaktSkjema from "@/components/KontaktSkjema";
import BoligKart from "@/components/BoligKart";

export const dynamic = "force-dynamic";

function formatPris(pris: number) {
  return new Intl.NumberFormat("nb-NO").format(pris) + " kr/mnd";
}

export default async function LeieDetalj({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bolig = await prisma.bolig.findUnique({ where: { id: parseInt(id), aktiv: true } });

  if (!bolig || bolig.type !== "leie") notFound();

  let bilder: string[] = [];
  try { bilder = JSON.parse(bolig.bilder); } catch {}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Venstre: Bilde + Detaljer */}
        <div className="lg:col-span-2 space-y-8">
          <BoligGalleri bilder={bilder} tittel={bolig.tittel} />

          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="inline-block bg-[var(--secondary)] text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
                  Til leie
                </span>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">{bolig.tittel}</h1>
                <p className="text-[var(--muted)] mt-1">{bolig.adresse}, {bolig.by}</p>
              </div>
              {bolig.pris && (
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-[var(--primary)]">{formatPris(bolig.pris)}</p>
                </div>
              )}
            </div>

            {/* Fakta-rad */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
              {[
                { label: "Type", verdi: "Utleie" },
                { label: "Størrelse", verdi: bolig.storrelse ? `${bolig.storrelse} m²` : "–" },
                { label: "Soverom", verdi: bolig.rom ? `${bolig.rom}` : "–" },
                { label: "Bad", verdi: bolig.bad ? `${bolig.bad}` : "–" },
              ].map((f) => (
                <div key={f.label} className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                  <p className="text-xs text-[var(--muted)] mb-1">{f.label}</p>
                  <p className="font-semibold text-[var(--foreground)]">{f.verdi}</p>
                </div>
              ))}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">Om boligen</h2>
              <p className="text-[var(--muted)] leading-relaxed whitespace-pre-wrap">{bolig.beskrivelse}</p>
            </div>
          </div>

          {bolig.lat && bolig.lng && (
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Beliggenhet</h2>
              <BoligKart lat={bolig.lat} lng={bolig.lng} adresse={bolig.adresse} />
            </div>
          )}
        </div>

        {/* Høyre: Kontaktskjema */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-white border border-[var(--border)] rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)] mb-5">Ta kontakt</h2>
            <KontaktSkjema boligId={bolig.id} boligTittel={bolig.tittel} />
          </div>
        </div>
      </div>
    </div>
  );
}
