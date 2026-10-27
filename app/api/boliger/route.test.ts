import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { bolig: { create: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

import { getServerSession } from "next-auth";
import { POST } from "./route";

// Mocken deles mellom testene; nullstill kallhistorikken så kall fra én test
// ikke lekker inn i en annens `not.toHaveBeenCalled()`-forventning.
beforeEach(() => {
  prismaMock.bolig.create.mockClear();
});

describe("POST /api/boliger", () => {
  it("avviser en gammel delt admin-sesjon uten bruker-id", async () => {
    const req = new Request("http://localhost/api/boliger", {
      method: "POST",
      body: JSON.stringify({ tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "" }),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(401);
    expect(prismaMock.bolig.create).not.toHaveBeenCalled();
  });

  it("fjerner relasjonsfelt og ukjente felt før oppretting", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" }, expires: "" } as never);
    prismaMock.bolig.create.mockResolvedValue({ id: 1 });

    const req = new Request("http://localhost/api/boliger", {
      method: "POST",
      body: JSON.stringify({
        tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "",
        delprosjekter: { create: [{ navn: "Hack" }] },
      }),
    });

    await POST(req as any);

    expect(prismaMock.bolig.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.bolig.create.mock.calls[0][0].data).not.toHaveProperty("delprosjekter");
  });

  it("avviser en ikke-heltalls kjøpesum med 400, og oppretter aldri", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" }, expires: "" } as never);

    const req = new Request("http://localhost/api/boliger", {
      method: "POST",
      body: JSON.stringify({
        tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "",
        kjopesum: 4.5,
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ugyldig kjøpesum.");
    expect(prismaMock.bolig.create).not.toHaveBeenCalled();
  });

  it("avviser en negativ salgssum med 400, og oppretter aldri", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "1", role: "eier" }, expires: "" } as never);

    const req = new Request("http://localhost/api/boliger", {
      method: "POST",
      body: JSON.stringify({
        tittel: "Test", adresse: "A", by: "Ålesund", type: "salg", beskrivelse: "",
        salgssum: -1,
      }),
    });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ugyldig salgssum.");
    expect(prismaMock.bolig.create).not.toHaveBeenCalled();
  });
});
