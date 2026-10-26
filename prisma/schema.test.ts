import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";

describe("AdminUser", () => {
  it("stores navn and rolle with a default role of eier", async () => {
    const prisma = await createTestDb();
    const bruker = await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: "hash", navn: "Magnus Nordmo" },
    });
    expect(bruker.navn).toBe("Magnus Nordmo");
    expect(bruker.rolle).toBe("eier");
  });
});
