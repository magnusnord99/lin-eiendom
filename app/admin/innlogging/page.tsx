import InnloggingSkjema from "./InnloggingSkjema";

export default function InnloggingPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="bg-white border border-[var(--border)] rounded-xl shadow-sm w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[var(--primary)] rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">L</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">LIN Eiendom Admin</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Logg inn for å administrere boliger</p>
        </div>
        <InnloggingSkjema />
      </div>
    </div>
  );
}
