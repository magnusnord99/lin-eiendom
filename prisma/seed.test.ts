import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { seedAdminUsers } from "./seed";
import { verifyPassword } from "../lib/password";

describe("seedAdminUsers", () => {
  it("creates a user whose stored password is hashed, not plaintext", async () => {
    const prisma = await createTestDb();
    await seedAdminUsers(prisma, [{ brukernavn: "oskar", passord: "test123", navn: "Oskar" }]);
    const bruker = await prisma.adminUser.findUniqueOrThrow({ where: { brukernavn: "oskar" } });
    expect(bruker.passord).not.toBe("test123");
    await expect(verifyPassword("test123", bruker.passord)).resolves.toBe(true);
  });

  it("is idempotent — running it twice does not create duplicates", async () => {
    const prisma = await createTestDb();
    const users = [{ brukernavn: "oskar", passord: "test123", navn: "Oskar" }];
    await seedAdminUsers(prisma, users);
    await seedAdminUsers(prisma, users);
    const count = await prisma.adminUser.count({ where: { brukernavn: "oskar" } });
    expect(count).toBe(1);
  });
});
