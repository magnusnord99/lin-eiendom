"use client";

import { useState } from "react";

interface KontaktSkjemaProps {
  boligId?: number;
  boligTittel?: string;
}

export default function KontaktSkjema({ boligId, boligTittel }: KontaktSkjemaProps) {
  const [form, setForm] = useState({ navn: "", epost: "", telefon: "", melding: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [feilmelding, setFeilmelding] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/kontakt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, boligId }),
    });

    if (res.ok) {
      setStatus("success");
    } else {
      const data = await res.json();
      setFeilmelding(data.error || "Noe gikk galt");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
        <div className="text-3xl mb-3">✓</div>
        <h3 className="font-semibold text-green-800 mb-1">Melding sendt!</h3>
        <p className="text-green-700 text-sm">Vi tar kontakt med deg snart.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {boligTittel && (
        <div className="bg-[var(--surface)] rounded-lg px-4 py-3 text-sm text-[var(--muted)] border border-[var(--border)]">
          Forespørsel om: <span className="font-medium text-[var(--foreground)]">{boligTittel}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            Navn <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.navn}
            onChange={(e) => setForm({ ...form, navn: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            placeholder="Ditt navn"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
            E-post <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={form.epost}
            onChange={(e) => setForm({ ...form, epost: e.target.value })}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            placeholder="din@epost.no"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Telefon</label>
        <input
          type="tel"
          value={form.telefon}
          onChange={(e) => setForm({ ...form, telefon: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          placeholder="+47 xxx xx xxx"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
          Melding <span className="text-red-500">*</span>
        </label>
        <textarea
          required
          value={form.melding}
          onChange={(e) => setForm({ ...form, melding: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent resize-none"
          placeholder="Skriv din melding her..."
        />
      </div>

      {status === "error" && (
        <p className="text-red-600 text-sm">{feilmelding}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-[var(--primary)] text-white py-3 rounded-md font-semibold text-sm hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
      >
        {status === "loading" ? "Sender..." : "Send melding"}
      </button>
    </form>
  );
}
