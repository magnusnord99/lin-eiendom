import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { TIMEREGISTRERING_EIER_FEIL } from "@/lib/timeregistrering";
import { UTGIFT_FEIL } from "@/lib/utgift";
import {
  opprettDelprosjektAction,
  registrerTimerAction,
  slettTimeregistreringAction,
  registrerUtgiftAction,
  slettUtgiftAction,
} from "./actions";

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

describe("registrerUtgiftAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(
      registrerUtgiftAction({ eiendomId: 1, dato: "2026-10-20", kategori: "Materialer", belop: 5000 })
    ).rejects.toThrow(/ikke autorisert/i);
  });
});

describe("slettUtgiftAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(slettUtgiftAction(1)).rejects.toThrow(/ikke autorisert/i);
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

describe("registrerUtgiftAction med innlogget sesjon", () => {
  it("avviser en kalenderdato som ikke finnes (2026-02-30)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      dato: "2026-02-30",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Ugyldig dato.");
  });

  it("avviser en tidsstempel-streng i stedet for en ren kalenderdato", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      dato: "2026-10-20T23:00:00.000Z",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Ugyldig dato.");
  });

  it.each([0, -500, 100.5, 2_147_483_648])("avviser et ugyldig beløp (%s)", async (belop) => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Beløp må være et positivt heltall.");
  });

  it("avviser en tom kategori", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerUtgiftAction({ eiendomId: 1, dato: "2026-10-20", kategori: "", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Kategori er påkrevd.");
  });

  it("avviser en kategori som bare består av mellomrom", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await registrerUtgiftAction({ eiendomId: 1, dato: "2026-10-20", kategori: "   ", belop: 5000 });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Kategori er påkrevd.");
  });

  it("avviser når delprosjektet hører til en annen eiendom", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { delprosjekt: { findUnique: ReturnType<typeof vi.fn> } }).delprosjekt = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, eiendomId: 2 }),
    };
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      delprosjektId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Delprosjektet finnes ikke på denne eiendommen.");
  });

  it("avviser når delprosjektet ikke finnes i det hele tatt", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { delprosjekt: { findUnique: ReturnType<typeof vi.fn> } }).delprosjekt = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      delprosjektId: 999,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Delprosjektet finnes ikke på denne eiendommen.");
  });

  it("avviser når betaleren ikke finnes", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      betaltAvBrukerId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Ugyldig betaler.");
  });

  it("avviser når betaleren finnes men ikke har rollen eier", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue({ id: 1, rolle: "annet" }),
    };
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      betaltAvBrukerId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Ugyldig betaler.");
  });

  it("avviser når eiendommen ikke finnes", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue(null),
    };
    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe("Fant ikke eiendommen.");
  });

  it("lykkes uten delprosjektId og betaltAvBrukerId, og kaller opprettUtgift med undefined for begge", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
    };
    const create = vi.fn().mockResolvedValue({ id: 1 });
    (prisma as unknown as { utgift: { create: ReturnType<typeof vi.fn> } }).utgift = { create };

    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });

    expect(resultat.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delprosjektId: undefined, betaltAvBrukerId: undefined }),
      })
    );
  });

  it("registrerer utgiften med den valgte betaleren (betaltAvBrukerId), ikke den innloggede brukeren", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "9", role: "eier" } } as never);
    (prisma as unknown as { bolig: { findUnique: ReturnType<typeof vi.fn> } }).bolig = {
      findUnique: vi.fn().mockResolvedValue({ id: 1 }),
    };
    (prisma as unknown as { adminUser: { findUnique: ReturnType<typeof vi.fn> } }).adminUser = {
      findUnique: vi.fn().mockResolvedValue({ id: 2, rolle: "eier" }),
    };
    const create = vi.fn().mockResolvedValue({ id: 1 });
    (prisma as unknown as { utgift: { create: ReturnType<typeof vi.fn> } }).utgift = { create };

    const resultat = await registrerUtgiftAction({
      eiendomId: 1,
      betaltAvBrukerId: 2,
      dato: "2026-10-20",
      kategori: "Materialer",
      belop: 5000,
    });

    expect(resultat.ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ betaltAvBrukerId: 2 }) })
    );
  });
});

describe("slettUtgiftAction med innlogget sesjon", () => {
  it("avviser et manglende id uten å kalle databasen", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    const resultat = await slettUtgiftAction(undefined as unknown as number);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.feilmelding).toBe(UTGIFT_FEIL);
  });

  it("lykkes ved sletting", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { utgift: { deleteMany: ReturnType<typeof vi.fn> } }).utgift = {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const resultat = await slettUtgiftAction(1);
    expect(resultat).toEqual({ ok: true, data: null });
  });

  it("oversetter en uventet databasefeil til en generisk feilmelding", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    (prisma as unknown as { utgift: { deleteMany: ReturnType<typeof vi.fn> } }).utgift = {
      deleteMany: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const resultat = await slettUtgiftAction(1);
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.feilmelding).toBe("Noe gikk galt. Prøv igjen.");
      expect(resultat.feilmelding).not.toBe("boom");
      expect(resultat.feilmelding).not.toBe(UTGIFT_FEIL);
    }
  });
});
