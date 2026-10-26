import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { name: "Admin" }, expires: "" }) }));

import { POST } from "./route";

describe("POST /api/upload", () => {
  it("avviser en gammel delt admin-sesjon uten bruker-id", async () => {
    const res = await POST(new Request("http://localhost/api/upload", { method: "POST" }) as any);
    expect(res.status).toBe(401);
  });
});
