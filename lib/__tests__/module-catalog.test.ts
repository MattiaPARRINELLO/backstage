import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOG_TIMEOUT_MS, fetchCatalog, readCatalog } from "@/lib/kernel/module-catalog";
import { jsonResponse, withHttpDouble } from "@/lib/http-double";

/**
 * Catalogue local : aucun test ne doit joindre GitHub. Chaque test utilise une
 * URL distincte pour ne pas dependre du cache memoire d'un autre test.
 */

const validEntries = [
  {
    id: "accreditations",
    source: "bundled",
    path: "modules/accreditations",
    repo: "https://github.com/mprnl/BS-accreditations",
    ref: "v1.0.0",
    distributable: true,
    description: "Scan des emails d'accreditation.",
    kit: "^0.1.0",
    env: ["GROQ_API_KEY"],
    visibility: "public",
  },
  {
    id: "calendar",
    source: "bundled",
    path: "modules/calendar",
    repo: null,
    ref: null,
    distributable: false,
    description: "Google Calendar.",
    kit: "^0.1.0",
    env: ["GOOGLE_CLIENT_ID"],
    visibility: null,
  },
  {
    id: "daily-quote",
    source: "external",
    path: null,
    repo: "https://github.com/mprnl/BS-daily-quote",
    ref: "v1.0.0",
    distributable: true,
    description: "Une citation par jour.",
    kit: "^0.1.0",
    env: [],
    visibility: "public",
  },
];

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lecture du catalogue de modules", () => {
  it("valide le catalogue et expose chaque entree", async () => {
    const url = "https://catalog.test/valide/catalog.json";
    await withHttpDouble([{ match: url, response: jsonResponse(validEntries) }], async () => {
      const catalog = await readCatalog({ url, token: null });

      expect(catalog.ok).toBe(true);
      if (!catalog.ok) return;
      expect(catalog.entries).toHaveLength(3);
      expect(catalog.ignored).toBe(0);
      expect(catalog.fromCache).toBe(false);
      expect(catalog.entries[0]).toMatchObject({
        id: "accreditations",
        source: "bundled",
        distributable: true,
        ref: "v1.0.0",
        requiresToken: false,
      });
      expect(catalog.entries[1]).toMatchObject({ path: "modules/calendar", repo: null });
    });
  });

  it("ignore une entree invalide sans perdre les autres", async () => {
    const url = "https://catalog.test/invalide/catalog.json";
    const payload = [...validEntries, { id: "cassee", source: "external", distributable: false }];

    await withHttpDouble([{ match: url, response: jsonResponse(payload) }], async () => {
      const catalog = await readCatalog({ url, token: null });

      expect(catalog.ok).toBe(true);
      if (!catalog.ok) return;
      expect(catalog.entries).toHaveLength(3);
      expect(catalog.ignored).toBe(1);
      expect(catalog.entries.map((entry) => entry.id)).not.toContain("cassee");
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("entree 3 ignoree"));
    });
  });

  it("signale un catalogue vide au lieu de le confondre avec aucun module", async () => {
    const url = "https://catalog.test/vide/catalog.json";
    await withHttpDouble([{ match: url, response: jsonResponse([]) }], async () => {
      const catalog = await readCatalog({ url, token: null });

      expect(catalog).toMatchObject({ ok: false, entries: [], fromCache: false });
      if (catalog.ok) return;
      expect(catalog.error).toContain("catalogue vide");
    });
  });

  it("signale un catalogue dont toutes les entrees sont invalides", async () => {
    const url = "https://catalog.test/tout-invalide/catalog.json";
    await withHttpDouble(
      [{ match: url, response: jsonResponse([{ id: "x" }, { id: "y" }]) }],
      async () => {
        const catalog = await readCatalog({ url, token: null });

        expect(catalog.ok).toBe(false);
        if (catalog.ok) return;
        expect(catalog.error).toContain("aucune entree valide");
      }
    );
  });

  it("renvoie une erreur explicite quand le reseau echoue", async () => {
    const url = "https://catalog.test/panne/catalog.json";
    await withHttpDouble([], async () => {
      const catalog = await readCatalog({ url, token: null });

      expect(catalog).toMatchObject({ ok: false, entries: [], fromCache: false, fetchedAt: null });
      if (catalog.ok) return;
      expect(catalog.error).toContain("Catalogue des modules injoignable");
    });
  });

  it("borne la lecture par un timeout court", async () => {
    const url = "https://catalog.test/timeout/catalog.json";
    let signal: AbortSignal | undefined;

    await withHttpDouble(
      [
        {
          match: url,
          response: (_url, init) => {
            signal = init.signal ?? undefined;
            throw new DOMException("The operation was aborted.", "TimeoutError");
          },
        },
      ],
      async () => {
        const catalog = await readCatalog({ url, token: null });

        expect(catalog.ok).toBe(false);
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(CATALOG_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
      }
    );
  });

  it("marque une entree privee comme dependante d'un token", async () => {
    const url = "https://catalog.test/prive/catalog.json";
    const payload = [{ ...validEntries[2], visibility: "private" }];

    await withHttpDouble([{ match: url, response: jsonResponse(payload) }], async () => {
      const sansToken = await readCatalog({ url, token: null });
      expect(sansToken.ok).toBe(true);
      if (!sansToken.ok) return;
      expect(sansToken.entries[0]?.requiresToken).toBe(true);
    });

    const avecTokenUrl = "https://catalog.test/prive-token/catalog.json";
    await withHttpDouble(
      [{ match: avecTokenUrl, response: jsonResponse(payload) }],
      async (double) => {
        const avecToken = await readCatalog({ url: avecTokenUrl, token: "jeton-de-test" });
        expect(avecToken.ok).toBe(true);
        if (!avecToken.ok) return;
        expect(avecToken.entries[0]?.requiresToken).toBe(false);
        expect(double.calls[0]?.init.headers).toMatchObject({
          authorization: "Bearer jeton-de-test",
        });
      }
    );
  });

  it("sert le cache sur une lecture rapprochee, puis le rend en secours d'un echec", async () => {
    const url = "https://catalog.test/cache/catalog.json";

    await withHttpDouble([{ match: url, response: jsonResponse(validEntries) }], async (double) => {
      await readCatalog({ url, token: null });
      const cached = await readCatalog({ url, token: null });

      expect(cached).toMatchObject({ ok: true, fromCache: true });
      expect(double.calls).toHaveLength(1);
    });

    await withHttpDouble([], async () => {
      const stale = await fetchCatalog({ url, token: null });

      expect(stale).toMatchObject({ ok: false, fromCache: true });
      if (stale.ok) return;
      expect(stale.entries).toHaveLength(3);
      expect(stale.fetchedAt).not.toBeNull();
      expect(stale.error).toContain("Catalogue des modules injoignable");
    });
  });
});
