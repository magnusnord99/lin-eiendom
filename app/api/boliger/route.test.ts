import { describe, it, expect, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { bolig: { create: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

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
});
