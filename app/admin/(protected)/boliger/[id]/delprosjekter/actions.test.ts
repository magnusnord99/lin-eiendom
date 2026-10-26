import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { TIMEREGISTRERING_EIER_FEIL } from "@/lib/timeregistrering";
import { opprettDelprosjektAction, registrerTimerAction, slettTimeregistreringAction } from "./actions";

describe("opprettDelprosjektAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(opprettDelprosjektAction({ eiendomId: 1, navn: "Kjøkken" })).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("registrerTimerAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(
      registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 4 })
    ).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettTimeregistreringAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettTimeregistreringAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("registrerTimerAction med innlogget sesjon", () => {
  it("avviser antallTimer utenfor 0–24", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 0 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/timer/i);
  });

  it("avviser manglende dato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: null as unknown as string, antallTimer: 4 });
    expect(resultat.ok).toBe(false);
  });

  it("avviser en kalenderdato som ikke finnes (2026-02-30)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-02-30", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser en tidsstempel-streng i stedet for en ren kalenderdato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20T23:00:00.000Z", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser når delprosjektet hører til en annen eiendom", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { delprosjekt: { findUnique: ReturnType<typeof vi.fn> } }).delprosjekt = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, eiendomId: 2 }),
    };
    const resultat = await registrerTimerAction({ eiendomId: 1, delprosjektId: 1, dato: "2026-10-20", antallTimer: 4 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/finnes ikke/i);
  });
});

describe("slettTimeregistreringAction med innlogget sesjon", () => {
  it("avviser et manglende id uten å kalle databasen", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await slettTimeregistreringAction(undefined as unknown as number);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe(TIMEREGISTRERING_EIER_FEIL);
  });

  it("oversetter en uventet databasefeil til en generisk feilmelding", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { timeregistrering: { deleteMany: ReturnType<typeof vi.fn> } }).timeregistrering = {
      deleteMany: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const resultat = await slettTimeregistreringAction(1);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.feilmelding).toBe("Noe gikk galt. Prøv igjen.");
      expect(resultat.feilmelding).not.toBe("boom");
      expect(resultat.feilmelding).not.toBe(TIMEREGISTRERING_EIER_FEIL);
    }
  });
});
