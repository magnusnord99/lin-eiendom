import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { KAPITALINNSKUDD_FEIL } from "@/lib/kapitalinnskudd";
import { registrerInnskuddAction, slettInnskuddAction } from "./actions";

describe("registrerInnskuddAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(
      registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 5000 })
    ).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettInnskuddAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettInnskuddAction(1)).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("registrerInnskuddAction med innlogget sesjon", () => {
  it("avviser et beløp som ikke er et positivt heltall", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 0 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/beløp/i);
  });

  it("avviser et negativt beløp", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: -500 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/beløp/i);
  });

  it("avviser et beløp med desimaler", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 100.5 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/beløp/i);
  });

  it("avviser et beløp over Prismas 32-bit Int-grense", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({
      eiendomId: 1,
      brukerId: 1,
      dato: "2026-10-20",
      belop: 2_147_483_648,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/beløp/i);
  });

  it("avviser en kalenderdato som ikke finnes (2026-02-30)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-02-30", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser en tidsstempel-streng i stedet for en ren kalenderdato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerInnskuddAction({
      eiendomId: 1,
      brukerId: 1,
      dato: "2026-10-20T23:00:00.000Z",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/dato/i);
  });

  it("avviser når eiendommen ikke finnes", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/eiendommen/i);
  });

  it("avviser når brukeren ikke er en registrert eier", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
    };
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/eier/i);
  });

  it("avviser når brukeren finnes men ikke har rollen eier", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
    };
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, rolle: "annet" }),
    };
    const resultat = await registrerInnskuddAction({ eiendomId: 1, brukerId: 1, dato: "2026-10-20", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toMatch(/eier/i);
  });

  it("krediterer den valgte eieren (brukerId), ikke den innloggede brukeren", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "9", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
    };
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue({ id: 2, rolle: "eier" }),
    };
    const create = vi.fn().mockResolvedValue({ id: 1 });
    (prisma as unknown as { kapitalinnskudd: { create: ReturnType<typeof vi.fn> } }).kapitalinnskudd = {
      create,
    };

    const resultat = await registrerInnskuddAction({
      eiendomId: 1,
      brukerId: 2,
      dato: "2026-10-20",
      belop: 5000,
    });

    expect(resultat.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ brukerId: 2 }) })
    );
  });
});

describe("slettInnskuddAction med innlogget sesjon", () => {
  it("avviser et manglende id uten å kalle databasen", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await slettInnskuddAction(undefined as unknown as number);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe(KAPITALINNSKUDD_FEIL);
  });

  it("oversetter en uventet databasefeil til en generisk feilmelding", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { kapitalinnskudd: { deleteMany: ReturnType<typeof vi.fn> } }).kapitalinnskudd = {
      deleteMany: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const resultat = await slettInnskuddAction(1);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.feilmelding).toBe("Noe gikk galt. Prøv igjen.");
      expect(resultat.feilmelding).not.toBe("boom");
      expect(resultat.feilmelding).not.toBe(KAPITALINNSKUDD_FEIL);
    }
  });
});
