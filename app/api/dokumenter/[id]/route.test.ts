// app/api/dokumenter/[id]/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
// @ts-expect-error -- next/dist/compiled/content-disposition ships without type declarations
import contentDisposition from "next/dist/compiled/content-disposition";

const { prismaMock, getMock, delMock } = vi.hoisted(() => ({
  prismaMock: {
    dokument: { findUnique: vi.fn(), delete: vi.fn() },
  },
  getMock: vi.fn(),
  delMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "7", role: "eier" }, expires: "" }) }));
vi.mock("@vercel/blob", () => ({ get: getMock, del: delMock }));

import { getServerSession } from "next-auth";
import { GET, DELETE } from "./route";

beforeEach(() => {
  prismaMock.dokument.findUnique.mockReset();
  prismaMock.dokument.delete.mockReset();
  getMock.mockReset();
  delMock.mockReset();
});

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function readableFromString(innhold: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(innhold);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

describe("GET /api/dokumenter/[id]", () => {
  it("gir 401 uten sesjon, og kaller aldri hentDokumentForNedlasting/get", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/api/dokumenter/1") as any, paramsFor("1") as any);

    expect(res.status).toBe(401);
    expect(prismaMock.dokument.findUnique).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("gir 404 for en ikke-eksisterende id", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/dokumenter/1") as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(typeof body.error).toBe("string");
    expect(getMock).not.toHaveBeenCalled();
  });

  it("henter blob-objektet privat og strømmer innholdet tilbake med riktige headere", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue({
      blobPathname: "dokumenter/eiendom-1/123-kontrakt.pdf",
      mimeType: "application/pdf",
      navn: "kontrakt.pdf",
    });
    getMock.mockResolvedValue({
      statusCode: 200,
      stream: readableFromString("hei"),
      headers: new Headers(),
      blob: { contentType: "application/pdf", size: 3 },
    });

    const res = await GET(new Request("http://localhost/api/dokumenter/1") as any, paramsFor("1") as any);
    const body = await res.text();

    expect(getMock).toHaveBeenCalledWith("dokumenter/eiendom-1/123-kontrakt.pdf", { access: "private" });
    expect(res.status).toBe(200);
    expect(body).toBe("hei");
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("gir 404 hvis DB-raden finnes men Blob-objektet er borte", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue({
      blobPathname: "dokumenter/eiendom-1/123-kontrakt.pdf",
      mimeType: "application/pdf",
      navn: "kontrakt.pdf",
    });
    getMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/dokumenter/1") as any, paramsFor("1") as any);

    expect(res.status).toBe(404);
  });

  it("gir 400 for en ikke-numerisk id, og kaller aldri hentDokumentForNedlasting/get", async () => {
    const res = await GET(new Request("http://localhost/api/dokumenter/abc") as any, paramsFor("abc") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(prismaMock.dokument.findUnique).not.toHaveBeenCalled();
    expect(getMock).not.toHaveBeenCalled();
  });

  describe("Content-Disposition-koding (DOC-002/DOC-005)", () => {
    const tilfeller: Array<[string, string]> = [
      ["en dash", "Kontrakt – signert.pdf"],
      ["anførselstegn", 'kvittering "ny".pdf'],
      ["kontrolltegn (linjeskift)", "kvittering\nny\rfil.pdf"],
      ["kombinasjon av ikke-ASCII og '()* ", "Kontrakt – signert (1)*'.pdf"],
    ];

    it.each(tilfeller)("navn med %s gir en gyldig, ikke-kastende Content-Disposition-header", async (_beskrivelse, navn) => {
      prismaMock.dokument.findUnique.mockResolvedValue({
        blobPathname: "dokumenter/eiendom-1/123-fil.pdf",
        mimeType: "application/pdf",
        navn,
      });
      getMock.mockResolvedValue({
        statusCode: 200,
        stream: readableFromString("x"),
        headers: new Headers(),
        blob: { contentType: "application/pdf", size: 1 },
      });

      const res = await GET(new Request("http://localhost/api/dokumenter/1") as any, paramsFor("1") as any);

      expect(res.status).toBe(200);
      const header = res.headers.get("Content-Disposition");
      expect(header).toBeTruthy();

      // Må faktisk parses av en ekte Content-Disposition-parser (ikke bare "se riktig ut").
      expect(() => contentDisposition.parse(header as string)).not.toThrow();
      const parsed = contentDisposition.parse(header as string);
      expect(parsed.type).toBe("attachment");
      // Filnavnet som parses ut (RFC 5987-varianten, siden den har prioritet) skal
      // ikke inneholde kontrolltegn, og skal rundtripp-matche det vi la inn (uten
      // kontrolltegnene, som helperen fjerner helt).
      const forventetUtenKontrolltegn = navn.replace(/[\x00-\x1F\x7F]/g, "");
      expect(parsed.parameters.filename).toBe(forventetUtenKontrolltegn);
    });
  });
});

describe("DELETE /api/dokumenter/[id]", () => {
  it("gir 401 uten sesjon, og kaller aldri del() eller dokument.delete", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await DELETE(new Request("http://localhost/api/dokumenter/1", { method: "DELETE" }) as any, paramsFor("1") as any);

    expect(res.status).toBe(401);
    expect(delMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.delete).not.toHaveBeenCalled();
  });

  it("gir 404 for en ikke-eksisterende id, og kaller aldri del()", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue(null);

    const res = await DELETE(new Request("http://localhost/api/dokumenter/1", { method: "DELETE" }) as any, paramsFor("1") as any);

    expect(res.status).toBe(404);
    expect(delMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.delete).not.toHaveBeenCalled();
  });

  it("(viktigste test) hvis Blob del() feiler, gir en feilrespons og sletter ALDRI DB-raden", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue({ id: 1, blobPathname: "dokumenter/eiendom-1/123-kontrakt.pdf" });
    delMock.mockRejectedValue(new Error("Blob service unavailable"));

    const res = await DELETE(new Request("http://localhost/api/dokumenter/1", { method: "DELETE" }) as any, paramsFor("1") as any);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(prismaMock.dokument.delete).not.toHaveBeenCalled();
  });

  it("lykkes: kaller del() med riktig pathname, så først deretter DB-slettingen, og gir 200", async () => {
    prismaMock.dokument.findUnique.mockResolvedValue({ id: 1, blobPathname: "dokumenter/eiendom-1/123-kontrakt.pdf" });
    delMock.mockResolvedValue(undefined);
    prismaMock.dokument.delete.mockResolvedValue({ id: 1 });

    const rekkefolge: string[] = [];
    delMock.mockImplementation(async () => {
      rekkefolge.push("del");
    });
    prismaMock.dokument.delete.mockImplementation(async () => {
      rekkefolge.push("dbDelete");
      return { id: 1 };
    });

    const res = await DELETE(new Request("http://localhost/api/dokumenter/1", { method: "DELETE" }) as any, paramsFor("1") as any);

    expect(res.status).toBe(200);
    expect(delMock).toHaveBeenCalledWith("dokumenter/eiendom-1/123-kontrakt.pdf");
    expect(rekkefolge).toEqual(["del", "dbDelete"]);
  });

  it("gir 400 for en ikke-numerisk id, og kaller aldri del()/dokument.delete", async () => {
    const res = await DELETE(new Request("http://localhost/api/dokumenter/abc", { method: "DELETE" }) as any, paramsFor("abc") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
    expect(delMock).not.toHaveBeenCalled();
    expect(prismaMock.dokument.delete).not.toHaveBeenCalled();
  });
});
