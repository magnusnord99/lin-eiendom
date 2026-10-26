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
    delprosjekt: {
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "1", role: "eier" }, expires: "" }) }));

import { PUT, DELETE } from "./route";
import { Prisma } from "@/app/generated/prisma/client";

// Mockene deles mellom testene; nullstill dem så kall fra én test ikke lekker inn
// i en annens `not.toHaveBeenCalled()`-forventning.
beforeEach(() => {
  for (const fn of Object.values(prismaMock.bolig)) fn.mockReset();
  prismaMock.delprosjekt.count.mockReset();
});

describe("PUT /api/boliger/[id]", () => {
  it("gir 409 hvis status ble endret av en annen mellom lesing og skriving", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 0 });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "solgt", forventetStatus: "til_salgs", forventetType: "salg" }),
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
      body: JSON.stringify({ status: "solgt", forventetStatus: "til_salgs", forventetType: "salg" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(200);
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "til_salgs", type: "salg" },
      data: { status: "solgt", type: "salg" },
    });
  });

  it("gir 409 når et utdatert skjema lagrer etter at en annen har endret status", async () => {
    // Raden er nå "solgt" (B lagret), men A sitt skjema ble lastet da den var "til_salgs".
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1, status: "solgt", type: "salg" });
    prismaMock.bolig.updateMany.mockResolvedValue({ count: 0 });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ status: "til_salgs", type: "salg", forventetStatus: "til_salgs", forventetType: "salg" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(409);
    // Betingelsen må bruke det klienten lastet, ikke den ferske lesingen ("solgt").
    expect(prismaMock.bolig.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, status: "til_salgs", type: "salg" } })
    );
    expect(prismaMock.bolig.update).not.toHaveBeenCalled();
  });

  it("faller tilbake til den ferske lesingen når forventetStatus/forventetType mangler", async () => {
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
  });

  it("gir 400 (ikke en ufanget feil) for tom type", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1, status: "til_salgs", type: "salg" });

    const req = new Request("http://localhost/api/boliger/1", {
      method: "PUT",
      body: JSON.stringify({ type: "" }),
    });

    const res = await PUT(req as any, { params: Promise.resolve({ id: "1" }) } as any);

    expect(res.status).toBe(400);
    expect(prismaMock.bolig.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.bolig.update).not.toHaveBeenCalled();
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

describe("DELETE /api/boliger/[id]", () => {
  it("gir 409 (rask vei) hvis eiendommen har registrerte delprosjekter, og sletter aldri", async () => {
    prismaMock.delprosjekt.count.mockResolvedValue(1);

    const req = new Request("http://localhost/api/boliger/1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Kan ikke slette en eiendom med registrerte delprosjekter.");
    expect(prismaMock.bolig.delete).not.toHaveBeenCalled();
  });

  it("gir 409 (ikke en ufanget 500) hvis et delprosjekt opprettes i kappløpet mellom sjekk og sletting", async () => {
    // Ingen delprosjekter ved sjekk-tidspunktet, men selve slettingen feiler med en
    // fremmednøkkel-feil (P2003) fordi noe ble opprettet i mellomtiden.
    prismaMock.delprosjekt.count.mockResolvedValue(0);
    prismaMock.bolig.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.6.0",
      })
    );

    const req = new Request("http://localhost/api/boliger/1", { method: "DELETE" });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: "1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("Kan ikke slette en eiendom med registrerte delprosjekter.");
  });
});
