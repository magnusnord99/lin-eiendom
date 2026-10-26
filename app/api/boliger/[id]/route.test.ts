// app/api/boliger/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    bolig: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "1", role: "eier" }, expires: "" }) }));

import { PUT } from "./route";

// Mockene deles mellom testene; nullstill dem så kall fra én test ikke lekker inn
// i en annens `not.toHaveBeenCalled()`-forventning.
beforeEach(() => {
  for (const fn of Object.values(prismaMock.bolig)) fn.mockReset();
});

describe("PUT /api/boliger/[id]", () => {
  it("gir 409 hvis status ble endret av en annen mellom lesing og skriving", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 0 });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "solgt" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(409);
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "til_salgs", type: "salg" } })
    );
    expect(prismaMock.bolig.update).not.toHaveBeenCalled();
  });

  it("oppdaterer status betinget når ingen samtidig endring har skjedd", async () => {
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "solgt", type: "salg" });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "solgt" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(200);
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "til_salgs", type: "salg" } })
    );
  });

  it("bruker vanlig update (ikke updateMany) for en ren tittel-redigering uten status/type", async () => {
    prismaMock.bolig.findUnique.mockResolvedValueOnce({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.update.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg", tittel: "Oppdatert tittel" });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ tittel: "Oppdatert tittel" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(200);
    expect(prismaMock.bolig.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { tittel: "Oppdatert tittel" } });
    expect(prismaMock.bolig.updateMany).not.toHaveBeenCalled();
  });
});
