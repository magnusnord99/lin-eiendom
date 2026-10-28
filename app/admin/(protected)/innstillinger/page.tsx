import { prisma } from "@/lib/prisma";
import { hentInnstilling } from "@/lib/innstilling";
import InnstillingerForm from "./InnstillingerForm";

export const dynamic = "force-dynamic";

export default async function InnstillingerPage() {
  const innstilling = await hentInnstilling(prisma);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Innstillinger</h1>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <h2 className="font-semibold text-[var(--foreground)] mb-5">Fordelingsnøkkel for fortjeneste</h2>
        <p className="text-sm text-[var(--muted)] mb-5">
          Resten av fortjenesten fordeles likt mellom eierne.
        </p>
        <InnstillingerForm initial={innstilling} />
      </div>
    </div>
  );
}
