import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  webSearch: vi.fn(),
  fetchPageMeta: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { pageMetaTool, webSearchTool } = await import("@/modules/web/tools");

const ctx = { moduleId: "web", log: () => {}, emit: () => {} };

describe("outils recherche web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend les resultats de recherche", async () => {
    storage.webSearch.mockResolvedValue("- Article\n  Description\n  https://example.com");
    const result = await webSearchTool.run({ query: "typescript" }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("https://example.com");
    expect(storage.webSearch).toHaveBeenCalledWith("typescript");
  });

  it("classe une recherche sans resultat comme vide", async () => {
    storage.webSearch.mockResolvedValue('Aucun résultat web pour "xyz".');
    const result = await webSearchTool.run({ query: "xyz" }, ctx);
    expect(result.status).toBe("empty");
  });

  it("rend le titre et la miniature d'une page", async () => {
    storage.fetchPageMeta.mockResolvedValue({
      title: "Un article",
      thumbnail: "https://example.com/img.png",
    });
    const result = await pageMetaTool.run({ url: "https://example.com" }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Titre : Un article");
    expect(result.text).toContain("Miniature : https://example.com/img.png");
  });

  it("refuse une URL privee sans la recuperer", async () => {
    storage.fetchPageMeta.mockResolvedValue({
      title: "URL non autorisée (adresse privée ou invalide)",
    });
    const result = await pageMetaTool.run({ url: "http://127.0.0.1/" }, ctx);
    expect(result.status).toBe("error");
  });

  it("classe une page sans titre comme vide", async () => {
    storage.fetchPageMeta.mockResolvedValue({ title: "Titre non trouvé" });
    const result = await pageMetaTool.run({ url: "https://example.com" }, ctx);
    expect(result.status).toBe("empty");
  });

  it("exige une requete et une URL", () => {
    expect(webSearchTool.params.safeParse({ query: "  " }).success).toBe(false);
    expect(pageMetaTool.params.safeParse({ url: "" }).success).toBe(false);
  });
});
