import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { opprettDelprosjektAction } from "./actions";

describe("opprettDelprosjektAction", () => {
  it("avviser når det ikke finnes en innlogget sesjon", async () => {
    await expect(opprettDelprosjektAction({ eiendomId: 1, navn: "Kjøkken" })).rejects.toThrow(/ikke autorisert/i);
  });
});
