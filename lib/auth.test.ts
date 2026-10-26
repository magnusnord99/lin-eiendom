import { describe, it, expect } from "vitest";
import { createTestDb } from "../tests/helpers/testDb";
import { hashPassword } from "./password";
import { buildAuthorize, authOptions, AUTH_VERSION, vurderSesjon } from "./auth";

describe("authorize", () => {
  it("returns the user with id and role on correct credentials", async () => {
    const prisma = await createTestDb();
    await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: await hashPassword("riktig-passord"), navn: "Magnus" },
    });
    const authorize = buildAuthorize(prisma);
    const result = await authorize({ username: "magnus", password: "riktig-passord" });
    expect(result).toMatchObject({ name: "Magnus", role: "eier" });
    expect(result?.id).toBeDefined();
  });

  it("rejects a wrong password", async () => {
    const prisma = await createTestDb();
    await prisma.adminUser.create({
      data: { brukernavn: "magnus", passord: await hashPassword("riktig-passord"), navn: "Magnus" },
    });
    const authorize = buildAuthorize(prisma);
    await expect(authorize({ username: "magnus", password: "feil" })).resolves.toBeNull();
  });

  it("rejects the old shared env-var credentials even if still set", async () => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "gammelt-passord";
    const prisma = await createTestDb();
    const authorize = buildAuthorize(prisma);
    await expect(authorize({ username: "admin", password: "gammelt-passord" })).resolves.toBeNull();
  });
});

describe("legacy session invalidation (F03)", () => {
  it("jwt callback does not stamp authVersion onto a pre-existing token with no fresh sign-in", async () => {
    const eksisterendeToken = { sub: "1", name: "Admin", email: "admin@lineiendom.no", id: "1" };
    const resultat = await authOptions.callbacks!.jwt!({ token: eksisterendeToken } as any);
    expect(resultat.authVersion).toBeUndefined();
    expect(resultat.id).toBeUndefined();
  });

  it("jwt callback stamps authVersion and copies id/role on a fresh sign-in", async () => {
    const resultat = await authOptions.callbacks!.jwt!({
      token: {},
      user: { id: "7", name: "Magnus", role: "eier" },
    } as any);
    expect(resultat).toMatchObject({ id: "7", role: "eier", authVersion: AUTH_VERSION });
  });

  it("session callback drops session.user for a token without the current authVersion", async () => {
    const gammelToken = { sub: "1", id: "1" };
    const sesjon = await authOptions.callbacks!.session!({
      session: { user: { name: "Admin" }, expires: "" },
      token: gammelToken,
    } as any);
    expect(sesjon.user).toBeUndefined();
  });

  it("session callback keeps id/role for a token stamped by the new authorize flow", async () => {
    const ferskToken = { id: "7", role: "eier", authVersion: AUTH_VERSION };
    const sesjon = await authOptions.callbacks!.session!({
      session: { user: {}, expires: "" },
      token: ferskToken,
    } as any);
    expect(sesjon.user).toMatchObject({ id: "7", role: "eier" });
  });
});

describe("vurderSesjon", () => {
  it("gir null for en null-sesjon", () => {
    expect(vurderSesjon(null)).toBeNull();
  });

  it("gir null for en sesjon uten user.id (gammel delt sesjon)", () => {
    expect(vurderSesjon({ user: { name: "Admin" }, expires: "" } as any)).toBeNull();
  });

  it("gir id og role for en gyldig sesjon", () => {
    expect(vurderSesjon({ user: { id: "7", role: "eier" }, expires: "" } as any)).toEqual({ id: "7", role: "eier" });
  });
});
