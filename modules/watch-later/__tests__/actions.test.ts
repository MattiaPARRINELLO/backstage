import { describe, it, expect, beforeEach, vi } from "vitest";

const service = {
  addWatchLaterItem: vi.fn(),
  deleteWatchLaterItem: vi.fn(),
  getWatchLater: vi.fn(),
  reorderWatchLaterItems: vi.fn(),
  updateWatchLaterItem: vi.fn(),
};

const summary = { summarizePage: vi.fn() };

vi.mock("@/modules/watch-later/service", () => service);
vi.mock("@/modules/watch-later/summary", () => summary);

const actions = await import("@/modules/watch-later/actions");

const activity = vi.fn();
const ctx = { moduleId: "watch-later", log: () => {}, emit: () => {}, activity };

/** Valide puis execute une action comme le fait `kernelAction`. */
async function runAction(name: keyof typeof actions, input: unknown): Promise<unknown> {
  const action = actions[name];
  const parsed = action.input.parse(input);
  const run = action.run as unknown as (value: unknown, context: unknown) => Promise<unknown>;
  return run(parsed, ctx);
}

const stored = {
  id: "1",
  url: "https://example.com",
  title: "Test",
  source: "example.com",
  category: "article" as const,
  read: false,
  createdAt: "",
};

describe("actions du module a voir plus tard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.getWatchLater.mockResolvedValue({ items: [] });
    summary.summarizePage.mockResolvedValue({ summary: "", tags: [] });
  });

  it("charge les donnees", async () => {
    const result = (await runAction("loadWatchLaterAction", {})) as { items: unknown[] };
    expect(result.items).toEqual([]);
  });

  it("cree un item et journalise l'activite", async () => {
    service.addWatchLaterItem.mockResolvedValue(stored);

    const item = (await runAction("createWatchLaterAction", {
      url: "https://example.com",
      title: "Test",
    })) as { title: string };

    expect(item.title).toBe("Test");
    expect(activity).toHaveBeenCalledWith(
      "watch_later_added",
      "À voir : Test",
      "https://example.com"
    );
    expect(service.addWatchLaterItem).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com", title: "Test" })
    );
  });

  it("enregistre le resume produit par la capacite IA", async () => {
    service.addWatchLaterItem.mockResolvedValue(stored);
    summary.summarizePage.mockResolvedValue({ summary: "Résumé", tags: ["tag1"] });

    await runAction("createWatchLaterAction", {
      url: "https://example.com",
      title: "Test",
    });

    expect(service.updateWatchLaterItem).toHaveBeenCalledWith("1", {
      summary: "Résumé",
      aiTags: ["tag1"],
    });
  });

  it("ne bloque pas la creation si le resume echoue", async () => {
    service.addWatchLaterItem.mockResolvedValue(stored);
    summary.summarizePage.mockRejectedValue(new Error("modele indisponible"));

    const item = (await runAction("createWatchLaterAction", {
      url: "https://example.com",
      title: "Test",
    })) as { id: string };

    expect(item.id).toBe("1");
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
    service.updateWatchLaterItem.mockResolvedValue({ id: "1", title: "Updated" });
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
    service.deleteWatchLaterItem.mockResolvedValue(true);
    const ok = await runAction("removeWatchLaterAction", { id: "1" });
    expect(ok).toBe(true);
    expect(activity).toHaveBeenCalledWith(
      "watch_later_deleted",
      "Element retire de A voir plus tard",
      "1"
    );
  });

  it("reordonne les items", async () => {
    service.reorderWatchLaterItems.mockResolvedValue(true);
    const ok = await runAction("reorderWatchLaterAction", { orderedIds: ["a", "b"] });
    expect(ok).toBe(true);
  });

  it("rejette une liste d'IDs vide", () => {
    const parsed = actions.reorderWatchLaterAction.input.safeParse({ orderedIds: [] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Liste d'IDs invalide");
  });

  it("resume un item existant et enregistre le resultat", async () => {
    service.getWatchLater.mockResolvedValue({ items: [stored] });
    summary.summarizePage.mockResolvedValue({ summary: "Résumé", tags: ["tag1"] });

    const result = (await runAction("summarizeWatchLaterAction", { id: "1" })) as {
      summary: string;
    };
    expect(result.summary).toBe("Résumé");
    expect(service.updateWatchLaterItem).toHaveBeenCalledWith("1", {
      summary: "Résumé",
      aiTags: ["tag1"],
    });
  });

  it("retourne null si l'item n'existe pas", async () => {
    const result = await runAction("summarizeWatchLaterAction", { id: "absent" });
    expect(result).toBeNull();
  });
});
