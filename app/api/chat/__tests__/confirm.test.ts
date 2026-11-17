import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

// Registre réel : c'est le lien entre l'action proposée et son exécution qui
// est testé ici. Seule l'exécution de l'outil est simulée.
const mockRunTool = vi.fn();
vi.mock("@/lib/chat-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat-tools")>();
  return { ...actual, runTool: mockRunTool };
});

const mockLogActivity = vi.fn();
vi.mock("@/lib/storage", () => ({ logActivity: mockLogActivity }));

const { POST } = await import("@/app/api/chat/confirm/route");
const { registerPendingAction, clearPendingActions } = await import("@/lib/chat-tools");

const EMAIL_ARGS = { email_id: "a", response_text: "ok" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingActions();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockLogActivity.mockResolvedValue(undefined);
    mockRunTool.mockResolvedValue({
      status: "ok",
      text: "Reponse envoyee (message id: m1).",
      rendered: "[OK] Reponse envoyee (message id: m1).",
    });
  });

  it("refuse sans session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ name: "send_email_response", arguments: EMAIL_ARGS }));
    expect(res.status).toBe(401);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse un outil non confirmable (pas de porte d'exécution arbitraire)", async () => {
    const res = await POST(makeRequest({ name: "web_search", arguments: { query: "x" } }));
    expect(res.status).toBe(400);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("exécute une écriture mise en attente pour cause de provenance", async () => {
    // Cas de l'issue #124 : `add_reminder` n'exige pas de confirmation
    // permanente, mais un tour contaminé le met en attente. Le confirmer doit
    // l'exécuter, pas répondre « action non confirmable ».
    registerPendingAction("add_reminder", { title: "Relancer", dueAt: "2026-11-27" }, "provenance");
    const res = await POST(
      makeRequest({ name: "add_reminder", arguments: { title: "Relancer", dueAt: "2026-11-27" } })
    );
    expect(res.status).toBe(200);
    expect(mockRunTool).toHaveBeenCalledWith(
      "add_reminder",
      { title: "Relancer", dueAt: "2026-11-27" },
      true
    );
  });

  it("refuse une écriture jamais proposée par le serveur", async () => {
    const res = await POST(
      makeRequest({ name: "create_github_issue", arguments: { title: "x" } })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Action non confirmee par le serveur" });
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse une action jamais proposée par le serveur", async () => {
    const res = await POST(makeRequest({ name: "send_email_response", arguments: EMAIL_ARGS }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Action non confirmee par le serveur" });
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse des arguments substitués après l'enregistrement", async () => {
    registerPendingAction("send_email_response", EMAIL_ARGS);
    const res = await POST(
      makeRequest({
        name: "send_email_response",
        arguments: { email_id: "a", response_text: "texte different" },
      })
    );
    expect(res.status).toBe(400);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("exécute une action enregistrée, puis refuse son rejeu", async () => {
    registerPendingAction("send_email_response", EMAIL_ARGS);

    const first = await POST(
      makeRequest({ name: "send_email_response", arguments: EMAIL_ARGS })
    );
    expect(first.status).toBe(200);
    expect(mockRunTool).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalled();

    const replay = await POST(
      makeRequest({ name: "send_email_response", arguments: EMAIL_ARGS })
    );
    expect(replay.status).toBe(400);
    expect(mockRunTool).toHaveBeenCalledTimes(1);
  });

  it("marque un echec meme sans exception (statut non OK)", async () => {
    registerPendingAction("send_email_response", {});
    mockRunTool.mockResolvedValue({
      status: "error",
      text: "Erreur : email_id et response_text requis.",
      rendered: "[ERREUR] Erreur : email_id et response_text requis.",
    });
    const res = await POST(makeRequest({ name: "send_email_response", arguments: {} }));
    expect(res.status).toBe(500);
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("répond 500 et journalise en cas d'échec", async () => {
    registerPendingAction("send_email_response", {});
    mockRunTool.mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({ name: "send_email_response", arguments: {} }));
    expect(res.status).toBe(500);
    expect(mockLogActivity).toHaveBeenCalled();
  });

  it("répond 400 sur un corps invalide", async () => {
    const res = await POST(new Request("http://localhost/api/chat/confirm", {
      method: "POST",
      body: "pas du json",
    }));
    expect(res.status).toBe(400);
  });
});
