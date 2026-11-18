import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  addWatchLaterItem: vi.fn(),
  deleteWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
  reorderWatchLaterItems: vi.fn(),
  updateWatchLaterItem: vi.fn(),
  autoSummarize: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

const actions = await import("@/modules/watch-later/actions");

const ctx = { moduleId: "watch-later", log: () => {}, emit: () => {} };

/** Valide puis execute une action comme le fait `kernelAction`. */
async function runAction(name: keyof typeof actions, input: unknown): Promise<unknown> {
  const action = actions[name];
  const parsed = action.input.parse(input);
  const run = action.run as unknown as (value: unknown, context: unknown) => Promise<unknown>;
  return run(parsed, ctx);
}

describe("actions du module a voir plus tard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.getWatchLater.mockResolvedValue({ items: [] });
  });

  it("charge les donnees", async () => {
    const result = (await runAction("loadWatchLaterAction", {})) as { items: unknown[] };
    expect(result.items).toEqual([]);
  });

  it("cree un item et journalise l'activite", async () => {
    mockStorage.addWatchLaterItem.mockResolvedValue({
      id: "1",
      url: "https://example.com",
      title: "Test",
      category: "article",
      read: false,
      createdAt: "",
    });
    mockStorage.autoSummarize.mockResolvedValue({ summary: "", tags: [] });

    const item = (await runAction("createWatchLaterAction", {
      url: "https://example.com",
      title: "Test",
    })) as { title: string };

    expect(item.title).toBe("Test");
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("rejette une URL invalide", () => {
    const parsed = actions.createWatchLaterAction.input.safeParse({
      url: "pas-une-url",
      title: "Test",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("URL invalide");
  });

  it("modifie un item", async () => {
    mockStorage.updateWatchLaterItem.mockResolvedValue({ id: "1", title: "Updated" });
    const updated = (await runAction("editWatchLaterAction", {
      id: "1",
      title: "Updated",
    })) as { title: string };
    expect(updated.title).toBe("Updated");
  });

  it("rejette un identifiant vide", () => {
    const parsed = actions.editWatchLaterAction.input.safeParse({ id: "", title: "Test" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Identifiant requis");
  });

  it("supprime un item", async () => {
    mockStorage.deleteWatchLaterItem.mockResolvedValue(true);
    const ok = await runAction("removeWatchLaterAction", { id: "1" });
    expect(ok).toBe(true);
    expect(mockStorage.logActivity).toHaveBeenCalled();
  });

  it("reordonne les items", async () => {
    mockStorage.reorderWatchLaterItems.mockResolvedValue(true);
    const ok = await runAction("reorderWatchLaterAction", { orderedIds: ["a", "b"] });
    expect(ok).toBe(true);
  });

  it("rejette une liste d'IDs vide", () => {
    const parsed = actions.reorderWatchLaterAction.input.safeParse({ orderedIds: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Liste d'IDs invalide");
  });

  it("resume un item existant", async () => {
    mockStorage.getWatchLater.mockResolvedValue({
      items: [{ id: "1", url: "https://example.com", title: "Test" }],
    });
    mockStorage.autoSummarize.mockResolvedValue({ summary: "Résumé", tags: ["tag1"] });

    const result = (await runAction("summarizeWatchLaterAction", { id: "1" })) as {
      summary: string;
    };
    expect(result.summary).toBe("Résumé");
  });

  it("retourne null si l'item n'existe pas", async () => {
    const result = await runAction("summarizeWatchLaterAction", { id: "absent" });
    expect(result).toBeNull();
  });
});
