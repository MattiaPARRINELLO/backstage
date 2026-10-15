import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Graphe d'imports complet de app/api/chat/route.ts, mocké pour tester le
// handler isolément (aucun appel réseau ni IA réel).
const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

const mockCheckRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));

const mockGetModel = vi.fn();
vi.mock("@/lib/config", () => ({ getModel: mockGetModel }));

const mockStorage = {
  fetchPageMeta: vi.fn(),
  autoSummarize: vi.fn(),
};
vi.mock("@/lib/storage", () => mockStorage);

const mockBuildSystemPrompt = vi.fn();
vi.mock("@/lib/chat-prompts", () => ({ buildSystemPrompt: mockBuildSystemPrompt }));

const mockRunTool = vi.fn();
const mockConfirmationMessage = vi.fn();
vi.mock("@/lib/chat-tools", () => ({
  tools: [],
  REQUIRE_CONFIRMATION: new Set(["send_email_response"]),
  runTool: mockRunTool,
  confirmationMessage: mockConfirmationMessage,
}));

const mockPersistExtractedFacts = vi.fn().mockResolvedValue([]);
// Parsing et liste des faits restent reels : seule l'ecriture est simulee.
vi.mock("@/lib/memory-autosave", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/memory-autosave")>();
  return { ...actual, persistExtractedFacts: mockPersistExtractedFacts };
});

const mockStream = vi.fn();
const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai-providers", () => ({
  streamChatCompletion: mockStream,
  chatCompletion: mockChatCompletion,
}));

const { POST } = await import("@/app/api/chat/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function* fakeStream(events: unknown[]) {
  for (const e of events) yield e;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockCheckRateLimit.mockReturnValue(true);
    mockGetModel.mockResolvedValue({ primary: "model-test", alt: "model-test" });
    mockBuildSystemPrompt.mockResolvedValue("system prompt");
    mockConfirmationMessage.mockReturnValue("ACTION_BLOCKED:send_email_response");
    mockChatCompletion.mockResolvedValue({ content: "Résumé du lot d'actions", toolCalls: [] });
    // Retourne l'AsyncGenerator directement (pas de wrapper async : la route
    // itère dessus avec `for await`).
    mockStream.mockImplementation(() => fakeStream([{ type: "done", content: "Salut !" }]));
  });

  it("refuse sans session (401)", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Salut" }] }));
    expect(res.status).toBe(401);
  });

  it("refuse au-delà du rate limit (429)", async () => {
    mockCheckRateLimit.mockReturnValue(false);
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Salut" }] }));
    expect(res.status).toBe(429);
  });

  it("refuse un corps invalide (400)", async () => {
    const res = await POST(makeRequest({ messages: [] }));
    expect(res.status).toBe(400);
  });

  it("stream une réponse SSE avec l'événement done", async () => {
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Bonjour" }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(mockStream).toHaveBeenCalledWith(
      "model-test",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "personalbrain"
    );
  });

  it("memorise les faits extraits et les signale apres la reponse finale", async () => {
    // L'extraction doit etre ATTENDUE (pas de `void`) : c'est ce qui garantit
    // l'ecriture avant la fin de la requete.
    mockChatCompletion.mockResolvedValue({
      content: "- [dev] [0.9] Utilise TypeScript",
      toolCalls: [],
    });
    mockPersistExtractedFacts.mockImplementation(async (facts) => facts);

    const res = await POST(
      makeRequest({
        messages: [
          { role: "user", content: "Je code en TypeScript tous les jours pour mes projets" },
          { role: "assistant", content: "Note, je garde ca en tete pour la suite." },
        ],
      })
    );
    const text = await res.text();

    expect(mockPersistExtractedFacts).toHaveBeenCalledWith([
      { content: "Utilise TypeScript", category: "dev", confidence: 0.9 },
    ]);
    // L'evenement arrive apres le done : le flux reste ouvert le temps d'ecrire.
    expect(text.indexOf('"type":"memory_facts"')).toBeGreaterThan(text.indexOf('"type":"done"'));
  });

  it("n'emet rien quand l'extraction ne trouve aucun fait", async () => {
    mockChatCompletion.mockResolvedValue({ content: "NONE", toolCalls: [] });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Bonjour" }] }));
    const text = await res.text();
    expect(mockPersistExtractedFacts).not.toHaveBeenCalled();
    expect(text).not.toContain("memory_facts");
  });

  it("ecrit les faits meme si le client coupe le flux (seul le toast est perdu)", async () => {
    // Une deconnexion apres la reponse ne doit pas faire perdre l'ecriture.
    mockChatCompletion.mockResolvedValue({ content: "- [dev] [0.9] Fait durable", toolCalls: [] });
    const res = await POST(
      makeRequest({
        messages: [
          { role: "user", content: "Je code en TypeScript tous les jours pour mes projets" },
          { role: "assistant", content: "Note, je garde ca en tete pour la suite." },
        ],
      })
    );
    await res.body?.cancel();
    await new Promise((r) => setTimeout(r, 30));
    expect(mockPersistExtractedFacts).toHaveBeenCalled();
  });

  it("transmet le sessionId de la conversation au provider IA", async () => {
    const res = await POST(
      makeRequest({ messages: [{ role: "user", content: "Bonjour" }], sessionId: "conv-42" })
    );
    expect(res.status).toBe(200);
    await res.text();
    expect(mockStream).toHaveBeenCalledWith(
      "model-test",
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "conv-42"
    );
  });

  it("bloque un outil à effet externe sans confirmation et ne l'exécute pas", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        { type: "tool_start", toolCallId: "tc-1", name: "send_email_response", arguments: '{"email_id":"a","response_text":"ok"}' },
        { type: "done", content: "" },
      ])
    );
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Envoie un mail" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    // Une seule carte de confirmation groupée est émise (résumé IA) et le
    // résultat renvoyé au modèle est bloqué.
    expect(text).toContain('"type":"group_confirm"');
    expect(text).toContain('"summary":"Résumé du lot d\'actions"');
    expect(text).toContain("ACTION_BLOCKED");
    expect(mockRunTool).not.toHaveBeenCalled();
    expect(mockConfirmationMessage).toHaveBeenCalled();
  });

  it("exécute un outil de lecture (non confirmé) normalement", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
        { type: "done", content: "" },
      ])
    );
    mockRunTool.mockResolvedValue({
      status: "ok",
      text: "résultats web",
      rendered: "[OK] résultats web",
    });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("résultats web");
    expect(mockRunTool).toHaveBeenCalledWith("web_search", { query: "test" });
  });

  it("ne crée pas de carte de confirmation ni d'exécution pour des arguments JSON invalides", async () => {
    mockStream.mockImplementation(() =>
      fakeStream([
        {
          type: "tool_start",
          toolCallId: "tc-1",
          name: "send_email_response",
          arguments: '{"email_id":"a","response_text":invalide}',
        },
        { type: "done", content: "" },
      ])
    );
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Envoie un mail" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('"type":"group_confirm"');
    expect(text).toContain("Erreur: arguments d'outil invalides (JSON)");
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("injecte la règle d'honnêteté quand le dernier résultat d'outil est une erreur", async () => {
    let callCount = 0;
    mockStream.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeStream([
          { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
          { type: "done", content: "" },
        ]);
      }
      return fakeStream([{ type: "done", content: "Voilà le résultat." }]);
    });
    mockRunTool.mockResolvedValue({
      status: "error",
      text: "Erreur: boom",
      rendered: "[ERREUR] Erreur: boom",
    });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Voilà le résultat.");
    expect(callCount).toBe(2);
    const secondCallMessages = mockStream.mock.calls[1][1] as { role: string; content?: string }[];
    const lastMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMsg?.role).toBe("system");
    expect(lastMsg?.content).toContain("[OK]");
  });

  it("n'injecte pas la règle d'honnêteté quand le dernier résultat d'outil est un succès", async () => {
    let callCount = 0;
    mockStream.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return fakeStream([
          { type: "tool_start", toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
          { type: "done", content: "" },
        ]);
      }
      return fakeStream([{ type: "done", content: "Voilà le résultat." }]);
    });
    mockRunTool.mockResolvedValue({
      status: "ok",
      text: "résultats web",
      rendered: "[OK] résultats web",
    });
    const res = await POST(makeRequest({ messages: [{ role: "user", content: "Cherche" }] }));
    expect(res.status).toBe(200);
    // Consomme le stream : sans cela, l'itération 2 (appel n°2 de mockStream)
    // peut ne pas encore avoir démarré quand on inspecte les appels.
    await res.text();
    expect(callCount).toBe(2);
    const secondCallMessages = mockStream.mock.calls[1][1] as { role: string; content?: string }[];
    const lastMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMsg?.role).not.toBe("system");
  });
});
