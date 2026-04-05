"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InnloggingSkjema() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [feil, setFeil] = useState("");
  const [laster, setLaster] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLaster(true);
    setFeil("");

    const res = await signIn("credentials", {
      username: form.username,
      password: form.password,
      redirect: false,
    });

    if (res?.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setFeil("Feil brukernavn eller passord");
    }
    setLaster(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Brukernavn</label>
        <input
          type="text"
          required
          autoComplete="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          placeholder="admin"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1">Passord</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          placeholder="••••••••"
        />
      </div>
      {feil && <p className="text-red-600 text-sm">{feil}</p>}
      <button
        type="submit"
        disabled={laster}
        className="w-full bg-[var(--primary)] text-white py-2.5 rounded-md text-sm font-semibold hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
      >
        {laster ? "Logger inn..." : "Logg inn"}
      </button>
    </form>
  );
}
