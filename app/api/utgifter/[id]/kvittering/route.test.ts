import { describe, it, expect, vi, beforeEach } from "vitest";

const { utgiftMock } = vi.hoisted(() => ({
  utgiftMock: {
    hentKvittering: vi.fn(),
    lagreKvittering: vi.fn(),
  },
}));
vi.mock("@/lib/utgift", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utgift")>("@/lib/utgift");
  return {
    ...actual,
    hentKvittering: utgiftMock.hentKvittering,
    lagreKvittering: utgiftMock.lagreKvittering,
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { id: "1", role: "eier" }, expires: "" }) }));

import { getServerSession } from "next-auth";
import { UTGIFT_FEIL, UTGIFT_KVITTERING_FOR_STOR, UTGIFT_KVITTERING_UGYLDIG_FORMAT } from "@/lib/utgift";
import { GET, POST } from "./route";

beforeEach(() => {
  utgiftMock.hentKvittering.mockReset();
  utgiftMock.lagreKvittering.mockReset();
});

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/utgifter/[id]/kvittering", () => {
  it("gir 401 uten sesjon, og kaller aldri hentKvittering", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const res = await GET(new Request("http://localhost/api/utgifter/1/kvittering") as any, paramsFor("1") as any);

    expect(res.status).toBe(401);
    expect(utgiftMock.hentKvittering).not.toHaveBeenCalled();
  });

  it("gir 404 med UTGIFT_FEIL når kvitteringen ikke finnes", async () => {
    utgiftMock.hentKvittering.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/utgifter/1/kvittering") as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe(UTGIFT_FEIL);
  });

  it("gir 200 med riktig body og headere når kvitteringen finnes", async () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    utgiftMock.hentKvittering.mockResolvedValue({ bytes, mimeType: "image/png" });

    const res = await GET(new Request("http://localhost/api/utgifter/1/kvittering") as any, paramsFor("1") as any);
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(body.equals(bytes)).toBe(true);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("gir 400 for en ikke-numerisk id, og kaller aldri hentKvittering", async () => {
    const res = await GET(new Request("http://localhost/api/utgifter/abc/kvittering") as any, paramsFor("abc") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ugyldig id.");
    expect(utgiftMock.hentKvittering).not.toHaveBeenCalled();
  });
});

describe("POST /api/utgifter/[id]/kvittering", () => {
  it("gir 401 uten sesjon, og kaller aldri lagreKvittering", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const formData = new FormData();
    const req = new Request("http://localhost/api/utgifter/1/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("1") as any);

    expect(res.status).toBe(401);
    expect(utgiftMock.lagreKvittering).not.toHaveBeenCalled();
  });

  it("gir 400 'Ingen fil' når FormData ikke har et file-felt, og kaller aldri lagreKvittering", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/utgifter/1/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ingen fil");
    expect(utgiftMock.lagreKvittering).not.toHaveBeenCalled();
  });

  it("gir 400 for en ikke-numerisk id, og kaller aldri lagreKvittering", async () => {
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "kvittering.jpg", { type: "image/jpeg" }));
    const req = new Request("http://localhost/api/utgifter/abc/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("abc") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ugyldig id.");
    expect(utgiftMock.lagreKvittering).not.toHaveBeenCalled();
  });

  it("gir 400 'Ingen fil' når file-feltet finnes men ikke er en fil, og kaller aldri lagreKvittering", async () => {
    const req = {
      formData: async () => ({
        get: (key: string) => (key === "file" ? "ikke-en-fil" : null),
      }),
    };

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Ingen fil");
    expect(utgiftMock.lagreKvittering).not.toHaveBeenCalled();
  });

  it("gir 413 for en for stor fil uten å lese body, og kaller aldri lagreKvittering", async () => {
    class OversizedFile extends File {
      get size() {
        return 5_000_000;
      }
    }
    const file = new OversizedFile([], "stor.jpg", { type: "image/jpeg" });
    const arrayBufferSpy = vi.spyOn(file, "arrayBuffer");

    const req = {
      formData: async () => ({
        get: (key: string) => (key === "file" ? file : null),
      }),
    };

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toBe(UTGIFT_KVITTERING_FOR_STOR);
    expect(arrayBufferSpy).not.toHaveBeenCalled();
    expect(utgiftMock.lagreKvittering).not.toHaveBeenCalled();
  });

  it("gir 413 når lagreKvittering kaster UTGIFT_KVITTERING_FOR_STOR", async () => {
    utgiftMock.lagreKvittering.mockRejectedValue(new Error(UTGIFT_KVITTERING_FOR_STOR));

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "kvittering.jpg", { type: "image/jpeg" }));
    const req = new Request("http://localhost/api/utgifter/1/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toBe(UTGIFT_KVITTERING_FOR_STOR);
  });

  it("gir 400 når lagreKvittering kaster UTGIFT_KVITTERING_UGYLDIG_FORMAT", async () => {
    utgiftMock.lagreKvittering.mockRejectedValue(new Error(UTGIFT_KVITTERING_UGYLDIG_FORMAT));

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "kvittering.jpg", { type: "image/jpeg" }));
    const req = new Request("http://localhost/api/utgifter/1/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(UTGIFT_KVITTERING_UGYLDIG_FORMAT);
  });

  it("gir 404 når lagreKvittering kaster UTGIFT_FEIL", async () => {
    utgiftMock.lagreKvittering.mockRejectedValue(new Error(UTGIFT_FEIL));

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1, 2, 3])], "kvittering.jpg", { type: "image/jpeg" }));
    const req = new Request("http://localhost/api/utgifter/1/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("1") as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe(UTGIFT_FEIL);
  });

  it("gir 200 { ok: true } og kaller lagreKvittering med id og en Buffer av filinnholdet ved suksess", async () => {
    utgiftMock.lagreKvittering.mockResolvedValue(undefined);

    const innhold = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
    const formData = new FormData();
    formData.append("file", new File([innhold], "kvittering.jpg", { type: "image/jpeg" }));
    const req = new Request("http://localhost/api/utgifter/42/kvittering", { method: "POST", body: formData });

    const res = await POST(req as any, paramsFor("42") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(utgiftMock.lagreKvittering).toHaveBeenCalledTimes(1);
    const [, idArg, bytesArg] = utgiftMock.lagreKvittering.mock.calls[0];
    expect(idArg).toBe(42);
    expect(Buffer.isBuffer(bytesArg)).toBe(true);
    expect(bytesArg.equals(Buffer.from(innhold))).toBe(true);
  });
});
