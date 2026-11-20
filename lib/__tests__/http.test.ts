import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { json, request, text } from "@/lib/http";
import { jsonResponse, withHttpDouble } from "@/lib/http-double";

const payloadSchema = z.object({ value: z.number() });
const unavailable = { code: "external_unavailable" };

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("port HTTP", () => {
  it("valide une reponse JSON avec son schema", async () => {
    await withHttpDouble(
      [{ match: "https://api.test/ok", response: jsonResponse({ value: 42 }) }],
      async () => {
        await expect(json("https://api.test/ok", payloadSchema, { label: "test" })).resolves.toEqual({ value: 42 });
      }
    );
  });

  it("refuse une forme inattendue ou un JSON illisible sans retenter", async () => {
    await withHttpDouble(
      [
        { match: "https://api.test/shape", response: jsonResponse({ value: "non" }) },
        { match: "https://api.test/broken", response: new Response("pas du json") },
      ],
      async (double) => {
        await expect(
          json("https://api.test/shape", payloadSchema, { label: "test" })
        ).rejects.toMatchObject(unavailable);
        await expect(
          json("https://api.test/broken", payloadSchema, { label: "test" })
        ).rejects.toMatchObject(unavailable);
        expect(double.calls).toHaveLength(2);
      }
    );
  });

  it("retente une erreur 5xx puis reussit", async () => {
    let calls = 0;
    await withHttpDouble(
      [
        {
          match: "https://api.test/flaky",
          response: () => {
            calls += 1;
            return calls === 1 ? new Response("boom", { status: 500 }) : jsonResponse({ value: 1 });
          },
        },
      ],
      async (double) => {
        await expect(json("https://api.test/flaky", payloadSchema, { label: "test" })).resolves.toEqual({ value: 1 });
        expect(double.calls).toHaveLength(2);
      }
    );
  });

  it("ne retente jamais un 4xx", async () => {
    await withHttpDouble(
      [{ match: "https://api.test/absent", response: new Response("nope", { status: 404 }) }],
      async (double) => {
        await expect(
          json("https://api.test/absent", payloadSchema, { label: "test" })
        ).rejects.toMatchObject(unavailable);
        expect(double.calls).toHaveLength(1);
      }
    );
  });

  it("ne retente pas un POST par defaut", async () => {
    await withHttpDouble(
      [{ match: "https://api.test/write", response: new Response("boom", { status: 500 }) }],
      async (double) => {
        await expect(
          text("https://api.test/write", { label: "test", method: "POST", body: "x" })
        ).rejects.toMatchObject(unavailable);
        expect(double.calls).toHaveLength(1);
      }
    );
  });

  it("retente une erreur reseau puis abandonne en external_unavailable", async () => {
    await withHttpDouble(
      [
        {
          match: "https://api.test/down",
          response: () => {
            throw new TypeError("fetch failed");
          },
        },
      ],
      async (double) => {
        await expect(
          json("https://api.test/down", payloadSchema, { label: "test" })
        ).rejects.toMatchObject(unavailable);
        expect(double.calls).toHaveLength(2);
      }
    );
  });

  it("applique le timeout par tentative", async () => {
    await withHttpDouble(
      [
        {
          match: "https://api.test/slow",
          response: (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
        },
      ],
      async (double) => {
        await expect(
          text("https://api.test/slow", { label: "test", timeoutMs: 5, retries: 0 })
        ).rejects.toMatchObject(unavailable);
        expect(double.calls).toHaveLength(1);
      }
    );
  });

  it("retourne un 302 brut a `request` sans lever", async () => {
    await withHttpDouble(
      [
        {
          match: "https://api.test/redirect",
          response: new Response(null, { status: 302, headers: { location: "/suite" } }),
        },
      ],
      async () => {
        const response = await request("https://api.test/redirect", {
          label: "test",
          redirect: "manual",
          retries: 0,
        });
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("/suite");
      }
    );
  });

  it("journalise le libelle et la duree sans exposer l'URL", async () => {
    const info = vi.mocked(console.info);
    await withHttpDouble([{ match: /api\.test/, response: jsonResponse({ value: 1 }) }], async () => {
      await json("https://api.test/ok?token=secret", payloadSchema, { label: "brave" });
    });

    const line = String(info.mock.calls[0]?.[0] ?? "");
    expect(line).toContain("brave");
    expect(line).toContain("200");
    expect(line).toContain("ms");
    expect(line).not.toContain("secret");
  });
});
