import { describe, it, expect, beforeEach, vi } from "vitest";

// Dependances externes simulees : le modele, l'ecriture memoire et le journal.
// Le parsing des faits reste reel (c'est la porte d'entree des donnees).
const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai-providers", () => ({ chatCompletion: mockChatCompletion }));

const mockListFacts = vi.fn();
const mockPersistExtractedFacts = vi.fn();
vi.mock("@/lib/memory-autosave", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/memory-autosave")>();
  return {
    ...actual,
    listFactsForExtractionPrompt: mockListFacts,
    persistExtractedFacts: mockPersistExtractedFacts,
  };
});

const mockServerLog = vi.fn();
vi.mock("@/lib/logger", () => ({ serverLog: mockServerLog }));

const { extractMemoryFacts, runMemoryExtraction } = await import(
  "@/app/api/chat/memory-extraction"
);

const USED_MODEL = "model-test";
const USED_SESSION = "conv-42";

const userTurn = {
  role: "user" as const,
  content: "Je code en TypeScript tous les jours pour mes projets",
};
const assistantTurn = {
  role: "assistant" as const,
  content: "Note, je garde ca en tete pour la suite.",
};

describe("extractMemoryFacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFacts.mockResolvedValue("");
    mockChatCompletion.mockResolvedValue({ content: "NONE", toolCalls: [] });
  });

  it("demande l'extraction au modele avec la session et rend les faits parses", async () => {
    mockChatCompletion.mockResolvedValue({
      content: "- [dev] [0.9] Utilise TypeScript",
      toolCalls: [],
    });

    const facts = await extractMemoryFacts(USED_MODEL, [userTurn, assistantTurn], USED_SESSION);

    expect(facts).toEqual([
      { content: "Utilise TypeScript", category: "dev", confidence: 0.9 },
    ]);
    const [model, messages, tools, , sessionId] = mockChatCompletion.mock.calls[0] as [
      string,
      { role: string; content: string }[],
      unknown[],
      unknown,
      string,
    ];
    expect(model).toBe(USED_MODEL);
    expect(tools).toEqual([]);
    expect(sessionId).toBe(USED_SESSION);
    expect(messages[1]?.content).toContain("USER: Je code en TypeScript");
    expect(messages[1]?.content).toContain("ASSISTANT: Note, je garde ca en tete");
  });

  it("injecte les faits deja connus dans le prompt", async () => {
    mockListFacts.mockResolvedValue("- [dev] Connait TypeScript");

    await extractMemoryFacts(USED_MODEL, [userTurn, assistantTurn], USED_SESSION);

    const [, messages] = mockChatCompletion.mock.calls[0] as [
      string,
      { role: string; content: string }[],
    ];
    expect(messages[1]?.content).toContain("Deja en memoire (ne pas repeter)");
    expect(messages[1]?.content).toContain("- [dev] Connait TypeScript");
  });

  it("rend une liste vide sans lever quand le modele echoue", async () => {
    mockChatCompletion.mockRejectedValue(new Error("provider indisponible"));

    const facts = await extractMemoryFacts(USED_MODEL, [userTurn, assistantTurn], USED_SESSION);

    expect(facts).toEqual([]);
    expect(mockServerLog).toHaveBeenCalledWith(
      "chat",
      "error",
      "Memory extraction failed",
      expect.any(Error),
      true
    );
  });
});

describe("runMemoryExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListFacts.mockResolvedValue("");
    mockChatCompletion.mockResolvedValue({
      content: "- [dev] [0.9] Utilise TypeScript",
      toolCalls: [],
    });
    mockPersistExtractedFacts.mockImplementation(async (facts) => facts);
  });

  it("ecrit les faits puis emet l'evenement memory_facts", async () => {
    const send = vi.fn();
    const facts = [{ content: "Utilise TypeScript", category: "dev", confidence: 0.9 }];

    await runMemoryExtraction(
      USED_MODEL,
      [userTurn, assistantTurn],
      USED_SESSION,
      send
    );

    expect(mockPersistExtractedFacts).toHaveBeenCalledWith(facts);
    expect(send).toHaveBeenCalledWith({ type: "memory_facts", facts });
    // L'ecriture precede l'evenement : le toast ne doit jamais devancer le disque.
    expect(mockPersistExtractedFacts.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0]
    );
  });

  it("ajoute le contenu assistant du tour courant au transcript", async () => {
    const send = vi.fn();

    await runMemoryExtraction(USED_MODEL, [userTurn], USED_SESSION, send, assistantTurn.content);

    const [, messages] = mockChatCompletion.mock.calls[0] as [
      string,
      { role: string; content: string }[],
    ];
    expect(messages[1]?.content).toContain("ASSISTANT: Note, je garde ca en tete");
  });

  it("reste silencieux quand l'extraction ne trouve aucun fait", async () => {
    mockChatCompletion.mockResolvedValue({ content: "NONE", toolCalls: [] });
    const send = vi.fn();

    await runMemoryExtraction(USED_MODEL, [userTurn, assistantTurn], USED_SESSION, send);

    expect(mockPersistExtractedFacts).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("n'interroge pas le modele si le dernier message utilisateur est trop court", async () => {
    const shortUser = { role: "user" as const, content: "Salut" };

    await runMemoryExtraction(USED_MODEL, [shortUser, assistantTurn], USED_SESSION);

    expect(mockChatCompletion).not.toHaveBeenCalled();
    expect(mockPersistExtractedFacts).not.toHaveBeenCalled();
  });

  it("n'interroge pas le modele si aucun message assistant n'est assez long", async () => {
    const shortAssistant = { role: "assistant" as const, content: "Ok." };

    await runMemoryExtraction(USED_MODEL, [userTurn, shortAssistant], USED_SESSION);

    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("ignore les messages sans contenu texte et ne leve pas sur une erreur d'ecriture", async () => {
    mockPersistExtractedFacts.mockRejectedValue(new Error("disque plein"));

    await expect(
      runMemoryExtraction(
        USED_MODEL,
        [
          { role: "system", content: "system prompt" },
          userTurn,
          assistantTurn,
        ],
        USED_SESSION
      )
    ).resolves.toBeUndefined();
    expect(mockServerLog).toHaveBeenCalledWith(
      "chat",
      "error",
      "Memory extraction error",
      expect.any(Error),
      true
    );
  });
});
