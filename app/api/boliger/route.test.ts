import { describe, it, expect, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { bolig: { create: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

import { getServerSession } from "next-auth";
import { POST } from "./route";

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
});
