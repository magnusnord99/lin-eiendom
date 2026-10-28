import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { getServerSession } from "next-auth";
import { oppdaterInnstilling, INNSTILLING_FEIL } from "@/lib/innstilling";
import { oppdaterInnstillingAction } from "./actions";

vi.mock("@/lib/innstilling", async () => {
  const faktisk = await vi.importActual<typeof import("@/lib/innstilling")>("@/lib/innstilling");
  return { ...faktisk, oppdaterInnstilling: vi.fn() };
});

describe("oppdaterInnstillingAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(
      oppdaterInnstillingAction({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 })
    ).rejects.toThrow(/ikke autorisert/i);
  });

  it("kaller lib-funksjonen og returnerer ok:true for gyldig input med innlogget sesjon", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    vi.mocked(oppdaterInnstilling).mockResolvedValueOnce(undefined);

    const resultat = await oppdaterInnstillingAction({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });

    expect(oppdaterInnstilling).toHaveBeenCalledWith(
      expect.anything(),
      { arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 }
    );
    expect(resultat).toEqual({ ok: true, data: null });
  });

  it("oversetter INNSTILLING_FEIL fra lib-funksjonen til et avvist resultat", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    vi.mocked(oppdaterInnstilling).mockRejectedValueOnce(new Error(INNSTILLING_FEIL));

    const resultat = await oppdaterInnstillingAction({ arbeidstimerAndelProsent: 90, kapitalAndelProsent: 90 });

    expect(resultat).toEqual({ ok: false, feilmelding: INNSTILLING_FEIL });
  });

  it("oversetter en uventet feil fra lib-funksjonen til en generisk feilmelding", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" } } as never);
    vi.mocked(oppdaterInnstilling).mockRejectedValueOnce(new Error("boom"));

    const resultat = await oppdaterInnstillingAction({ arbeidstimerAndelProsent: 15, kapitalAndelProsent: 5 });

    expect(resultat.ok).toBe(false);
    if (!resultat.ok) {
      expect(resultat.feilmelding).toBe("Noe gikk galt. Prøv igjen.");
      expect(resultat.feilmelding).not.toBe("boom");
      expect(resultat.feilmelding).not.toBe(INNSTILLING_FEIL);
    }
  });
});
