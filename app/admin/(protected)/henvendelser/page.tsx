import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HenvendelserPage() {
  const henvendelser = await prisma.henvendelse.findMany({
    orderBy: { opprettet: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Henvendelser</h1>
        <span className="text-sm text-[var(--muted)]">{henvendelser.length} totalt</span>
      </div>

      {henvendelser.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--border)] px-6 py-16 text-center text-[var(--muted)] text-sm">
          Ingen henvendelser ennå.
        </div>
      ) : (
        <div className="space-y-4">
          {henvendelser.map((h) => (
            <div
              key={h.id}
              className={`bg-white rounded-xl border p-6 ${
                !h.lest ? "border-[var(--secondary)] shadow-sm" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{h.navn}</p>
                    {!h.lest && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Ny</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {new Date(h.opprettet).toLocaleDateString("no-NO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-sm">
                <div>
                  <p className="text-[var(--muted)] text-xs mb-0.5">E-post</p>
                  <a href={`mailto:${h.epost}`} className="text-[var(--primary)] hover:underline">{h.epost}</a>
                </div>
                {h.telefon && (
                  <div>
                    <p className="text-[var(--muted)] text-xs mb-0.5">Telefon</p>
                    <a href={`tel:${h.telefon}`} className="text-[var(--foreground)]">{h.telefon}</a>
                  </div>
                )}
                {h.adresse && (
                  <div>
                    <p className="text-[var(--muted)] text-xs mb-0.5">Adresse på objekt</p>
                    <p className="text-[var(--foreground)]">{h.adresse}</p>
                  </div>
                )}
              </div>

              {h.tilstand && (
                <div className="mb-3">
                  <span className="text-xs bg-[var(--surface)] text-[var(--muted)] px-2 py-1 rounded-md border border-[var(--border)]">
                    Tilstand: {h.tilstand}
                  </span>
                </div>
              )}

              <div className="bg-[var(--surface)] rounded-lg p-4 text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                {h.melding}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
