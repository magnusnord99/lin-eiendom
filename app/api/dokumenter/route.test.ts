// app/api/dokumenter/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, putMock, delMock } = vi.hoisted(() => ({
  prismaMock: {
    dokument: { create: vi.fn() },
    delprosjekt: { findUnique: vi.fn() },
    bolig: { findUnique: vi.fn() },
  },
  putMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "7", role: "eier" }, expires: "" }) }));
vi.mock("@vercel/blob", () => ({ put: putMock, del: delMock }));

import { getServerSession } from "next-auth";
import { POST } from "./route";

// Mockene deles mellom testene; nullstill dem så kall fra én test ikke lekker inn
// i en annens `not.toHaveBeenCalled()`-forventning.
beforeEach(() => {
  prismaMock.dokument.create.mockReset();
  prismaMock.delprosjekt.findUnique.mockReset();
  prismaMock.bolig.findUnique.mockReset();
  putMock.mockReset();
  delMock.mockReset();
});

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function byggFormData(felter: Record<string, string | undefined>, file?: File) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(felter)) {
    if (value !== undefined) formData.append(key, value);
  }
  if (file) formData.append("file", file);
  return formData;
}

describe("POST /api/dokumenter", () => {
  it("gir 401 uten sesjon, og kaller aldri put eller dokument.create", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const formData = byggFormData({ eiendomId: "1", kategori: "annet" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);

    expect(res.status).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 401 for en gammel delt admin-sesjon uten bruker-id", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { name: "Admin" }, expires: "" } as never);

    const formData = byggFormData({ eiendomId: "1", kategori: "annet" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);

    expect(res.status).toBe(401);
    expect(putMock).not.toHaveBeenCalled();
  });

  it("gir 400 når FormData ikke har et file-felt, og kaller aldri put eller dokument.create", async () => {
    const formData = byggFormData({ eiendomId: "1", kategori: "annet" });
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 400 for en fil med ugyldig filformat, og kaller aldri put eller dokument.create", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    const ugyldigFil = new File([new Uint8Array([0x00, 0x01, 0x02])], "ukjent.bin", { type: "application/octet-stream" });
    const formData = byggFormData({ eiendomId: "1", kategori: "annet" }, ugyldigFil);
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/ugyldig filformat/i);
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 413 for en fil over 4 MB, og kaller aldri put eller dokument.create", async () => {
    class OversizedFile extends File {
      get size() {
        return 4_000_001;
      }
    }
    const storFil = new OversizedFile([], "stor.png", { type: "image/png" });

    const req = {
      formData: async () => {
        const map = new Map<string, unknown>([
          ["eiendomId", "1"],
          ["kategori", "annet"],
          ["file", storFil],
        ]);
        return { get: (key: string) => map.get(key) ?? null };
      },
    };

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(typeof body.error).toBe("string");
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 400 for en ugyldig kategori, og kaller aldri put eller dokument.create", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    const formData = byggFormData({ eiendomId: "1", kategori: "ukjent-kategori" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 404 for en ikke-eksisterende eiendomId, og kaller aldri put eller dokument.create", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue(null);
    const formData = byggFormData({ eiendomId: "999", kategori: "annet" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(typeof body.error).toBe("string");
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("gir 400 når delprosjektId ikke tilhører den angitte eiendomId, og kaller aldri put eller dokument.create", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    prismaMock.delprosjekt.findUnique.mockResolvedValue({ eiendomId: 2 });
    const formData = byggFormData({ eiendomId: "1", kategori: "annet", delprosjektId: "5" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(putMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.create).not.toHaveBeenCalled();
  });

  it("lykkes: laster opp som privat, lagrer med riktig pathname og bruker-id, og returnerer 201 med id", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    putMock.mockResolvedValue({ pathname: "dokumenter/eiendom-1/123-bilde.png", url: "https://blob/x" });
    prismaMock.dokument.create.mockResolvedValue({ id: 42 });

    const formData = byggFormData({ eiendomId: "1", kategori: "bilde" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe(42);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0][2]).toMatchObject({ access: "private" });
    expect(prismaMock.dokument.create).toHaveBeenCalledTimes(1);
    const createArg = prismaMock.dokument.create.mock.calls[0][0];
    expect(createArg.data.blobPathname).toBe("dokumenter/eiendom-1/123-bilde.png");
    expect(createArg.data.opplastetAvBrukerId).toBe(7);
  });

  it("(kompenserende sletting) ruller tilbake Blob-objektet hvis dokument.create feiler, og returnerer en feilrespons", async () => {
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    putMock.mockResolvedValue({ pathname: "dokumenter/eiendom-1/123-bilde.png", url: "https://blob/x" });
    prismaMock.dokument.create.mockRejectedValue(new Error("FK constraint failed"));
    delMock.mockResolvedValue(undefined);

    const formData = byggFormData({ eiendomId: "1", kategori: "bilde" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(delMock).toHaveBeenCalledWith("dokumenter/eiendom-1/123-bilde.png");
  });

  it("(kompenserende sletting) logger lekkasjen og returnerer fortsatt en feilrespons hvis del() også feiler", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.bolig.findUnique.mockResolvedValue({ id: 1 });
    putMock.mockResolvedValue({ pathname: "dokumenter/eiendom-1/123-bilde.png", url: "https://blob/x" });
    prismaMock.dokument.create.mockRejectedValue(new Error("FK constraint failed"));
    delMock.mockRejectedValue(new Error("del failed"));

    const formData = byggFormData({ eiendomId: "1", kategori: "bilde" }, new File([PNG_BYTES], "bilde.png", { type: "image/png" }));
    const req = new Request("http://localhost/api/dokumenter", { method: "POST", body: formData });

    const res = await POST(req as any);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(delMock).toHaveBeenCalledWith("dokumenter/eiendom-1/123-bilde.png");
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
