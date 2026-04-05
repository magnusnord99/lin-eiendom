import BoligSkjema from "@/components/admin/BoligSkjema";
import Link from "next/link";

export default function NyBoligPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Link href="/admin/boliger" className="text-[var(--muted)] text-sm hover:text-[var(--foreground)]">
          ← Tilbake
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Ny bolig</h1>
      </div>
      <BoligSkjema />
    </div>
  );
}
