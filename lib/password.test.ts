import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("hashes so the stored value never equals the plaintext", async () => {
    const hash = await hashPassword("hemmelig123");
    expect(hash).not.toBe("hemmelig123");
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("hemmelig123");
    await expect(verifyPassword("hemmelig123", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against the hash", async () => {
    const hash = await hashPassword("hemmelig123");
    await expect(verifyPassword("feil-passord", hash)).resolves.toBe(false);
  });
});
