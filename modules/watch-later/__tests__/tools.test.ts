import { beforeEach, describe, expect, it, vi } from "vitest";

const service = {
  addWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
};

vi.mock("@/modules/watch-later/service", () => service);

const { addWatchLaterTool } = await import("@/modules/watch-later/tools");

const net = { isSafeUrl: vi.fn(), fetchText: vi.fn() };

const ctx = {
  moduleId: "watch-later",
  log: () => {},
  emit: () => {},
  net,
};

const item = {
  id: "w1",
  title: "Un article",
  source: "example.com",
  url: "https://example.com/a",
  category: "article" as const,
  createdAt: "",
};

describe("outil a voir plus tard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    net.isSafeUrl.mockResolvedValue(true);
    service.addWatchLaterItem.mockResolvedValue(item);
    service.getWatchLater.mockResolvedValue({ items: [item] });
  });

  it("refuse une URL privee sans rien ecrire", async () => {
    net.isSafeUrl.mockResolvedValue(false);
    const result = await addWatchLaterTool.run(
      { url: "http://127.0.0.1/secret", title: "Local" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("URL non autorisee");
    expect(service.addWatchLaterItem).not.toHaveBeenCalled();
  });

  it("refuse l'ecriture si le noyau ne fournit pas la capacite reseau", async () => {
    const result = await addWatchLaterTool.run(
      { url: "https://example.com/article", title: "Un article" },
      { moduleId: "watch-later", log: () => {}, emit: () => {} }
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("URL non autorisee");
    expect(service.addWatchLaterItem).not.toHaveBeenCalled();
  });

  it("confirme l'ecriture par relecture", async () => {
    const result = await addWatchLaterTool.run(
      { url: "https://example.com/article", title: "Un article" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("A voir plus tard");
    expect(service.addWatchLaterItem).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/article", title: "Un article" })
    );
  });

  it("signale un echec si la relecture ne retrouve pas le lien", async () => {
    service.getWatchLater.mockResolvedValue({ items: [] });
    const result = await addWatchLaterTool.run(
      { url: "https://example.com/article", title: "Un article" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("ecriture non confirmee");
  });
});
