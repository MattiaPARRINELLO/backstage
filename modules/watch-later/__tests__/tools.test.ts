import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  addWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
  isSafeFetchUrl: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { addWatchLaterTool } = await import("@/modules/watch-later/tools");

const ctx = { moduleId: "watch-later", log: () => {}, emit: () => {} };

const item = { id: "w1", title: "Un article", source: "example.com", url: "https://example.com/a" };

describe("outil a voir plus tard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.isSafeFetchUrl.mockResolvedValue(true);
    storage.addWatchLaterItem.mockResolvedValue(item);
    storage.getWatchLater.mockResolvedValue({ items: [item] });
  });

  it("refuse une URL privee sans rien ecrire", async () => {
    storage.isSafeFetchUrl.mockResolvedValue(false);
    const result = await addWatchLaterTool.run(
      { url: "http://127.0.0.1/secret", title: "Local" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("URL non autorisee");
    expect(storage.addWatchLaterItem).not.toHaveBeenCalled();
  });

  it("confirme l'ecriture par relecture", async () => {
    const result = await addWatchLaterTool.run(
      { url: "https://example.com/article", title: "Un article" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("A voir plus tard");
    expect(storage.addWatchLaterItem).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/article", title: "Un article" })
    );
  });

  it("signale un echec si la relecture ne retrouve pas le lien", async () => {
    storage.getWatchLater.mockResolvedValue({ items: [] });
    const result = await addWatchLaterTool.run(
      { url: "https://example.com/article", title: "Un article" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("ecriture non confirmee");
  });
});
