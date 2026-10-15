import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStorage = {
  addMemoryFact: vi.fn(),
  findSimilarMemoryFacts: vi.fn(),
  getMemory: vi.fn(),
  touchMemoryFact: vi.fn(),
  logActivity: vi.fn(),
};

vi.mock("@/lib/storage", () => mockStorage);

const {
  parseExtractedFacts,
  persistExtractedFacts,
  listFactsForExtractionPrompt,
  MIN_FACT_CONFIDENCE,
  MAX_FACTS_PER_TURN,
} = await import("@/lib/memory-autosave");

describe("parseExtractedFacts", () => {
  it("lit le format canonique", () => {
    const facts = parseExtractedFacts("- [dev] [0.9] Utilise TypeScript au quotidien");
    expect(facts).toEqual([
      { content: "Utilise TypeScript au quotidien", category: "dev", confidence: 0.9 },
    ]);
  });

  it("tolere puce markdown, numerotation et gras", () => {
    const raw = `Voici les faits :
**- [photo] [0,85] Photographie au 35mm
1. [life] [1.0] Se couche tard la semaine`;
    expect(parseExtractedFacts(raw)).toEqual([
      { content: "Photographie au 35mm", category: "photo", confidence: 0.85 },
      { content: "Se couche tard la semaine", category: "life", confidence: 1 },
    ]);
  });

  it("tolere une categorie sans crochets et une confiance en pourcentage", () => {
    expect(parseExtractedFacts("- preference 85% Prefere le cinema d'auteur")).toEqual([
      { content: "Prefere le cinema d'auteur", category: "preference", confidence: 0.85 },
    ]);
  });

  it("retourne un tableau vide pour NONE", () => {
    expect(parseExtractedFacts("NONE")).toEqual([]);
    expect(parseExtractedFacts("  none. rien a memoriser  ")).toEqual([]);
    expect(parseExtractedFacts("")).toEqual([]);
  });

  it("ignore une ligne sans confiance explicite (faux positifs de prose)", () => {
    expect(parseExtractedFacts("- Dev : rien a signaler")).toEqual([]);
    expect(parseExtractedFacts("- [life] Mattia aime le cafe")).toEqual([]);
  });

  it("ignore une categorie ou une confiance hors bornes", () => {
    expect(parseExtractedFacts("- [dev] [2.5] Impossible")).toEqual([]);
    expect(parseExtractedFacts("- [travail] [0.9] Categorie inconnue")).toEqual([]);
  });

  it("ignore un fait trop court ou trop long", () => {
    expect(parseExtractedFacts("- [dev] [0.9] ok")).toEqual([]);
    const long = "a".repeat(300);
    expect(parseExtractedFacts(`- [dev] [0.9] ${long}`)).toEqual([]);
  });

  it("plafonne le nombre de faits par tour", () => {
    const raw = Array.from({ length: 12 }, (_, i) => `- [dev] [0.9] Fait numero ${i}`).join("\n");
    expect(parseExtractedFacts(raw)).toHaveLength(MAX_FACTS_PER_TURN);
  });
});

describe("persistExtractedFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.addMemoryFact.mockResolvedValue({
      id: "new",
      content: "Nouveau fait",
      category: "dev",
      createdAt: "",
    });
  });

  it("enregistre un fait au-dessus du seuil avec la source auto-extract", async () => {
    mockStorage.findSimilarMemoryFacts.mockResolvedValue(null);
    const saved = await persistExtractedFacts([
      { content: "Nouveau fait", category: "dev", confidence: 0.8 },
    ]);
    expect(saved).toHaveLength(1);
    expect(mockStorage.addMemoryFact).toHaveBeenCalledWith("Nouveau fait", "dev", {
      source: "auto-extract",
      confidence: 0.8,
    });
  });

  it("ignore un fait sous le seuil de confiance", async () => {
    const saved = await persistExtractedFacts([
      { content: "Fait incertain", category: "dev", confidence: MIN_FACT_CONFIDENCE - 0.01 },
    ]);
    expect(saved).toHaveLength(0);
    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
  });

  it("renforce un fait deja connu au lieu de le dupliquer", async () => {
    mockStorage.findSimilarMemoryFacts.mockResolvedValue({
      id: "existing",
      content: "Utilise TypeScript",
      category: "dev",
      createdAt: "",
    });
    const saved = await persistExtractedFacts([
      { content: "Utilise TypeScript au quotidien", category: "dev", confidence: 0.95 },
    ]);
    expect(saved[0]?.id).toBe("existing");
    expect(mockStorage.addMemoryFact).not.toHaveBeenCalled();
    expect(mockStorage.touchMemoryFact).toHaveBeenCalledWith("existing");
  });

  it("journalise chaque fait reellement ajoute", async () => {
    mockStorage.findSimilarMemoryFacts.mockResolvedValue(null);
    await persistExtractedFacts([{ content: "Nouveau fait", category: "dev", confidence: 0.9 }]);
    expect(mockStorage.logActivity).toHaveBeenCalledWith(
      "memory_added",
      expect.stringContaining("Nouveau fait"),
      "dev"
    );
  });
});

describe("listFactsForExtractionPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formate les faits existants", async () => {
    mockStorage.getMemory.mockResolvedValue({
      facts: [{ id: "1", content: "Utilise TypeScript", category: "dev", createdAt: "" }],
      relationships: [],
      profile: { name: "Mattia", preferences: [] },
    });
    expect(await listFactsForExtractionPrompt()).toBe("- [dev] Utilise TypeScript");
  });

  it("retourne une chaine vide si la memoire est vide ou illisible", async () => {
    mockStorage.getMemory.mockResolvedValue({ facts: [], relationships: [], profile: { name: "", preferences: [] } });
    expect(await listFactsForExtractionPrompt()).toBe("");
    mockStorage.getMemory.mockRejectedValue(new Error("fs KO"));
    expect(await listFactsForExtractionPrompt()).toBe("");
  });
});
