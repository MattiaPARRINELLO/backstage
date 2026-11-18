import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

// Registre réel : un lot ne s'exécute que si chaque action a bien été proposée
// par le serveur. Seule l'exécution des outils est simulée.
const mockRunTool = vi.fn();
vi.mock("@/lib/chat-tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chat-tools")>();
  return { ...actual, runTool: mockRunTool };
});

const mockLogActivity = vi.fn();
vi.mock("@/lib/storage", () => ({ logActivity: mockLogActivity }));

const mockApplyConfirmedToolResults = vi.fn();
vi.mock("@/lib/storage/chat-history", () => ({
  applyConfirmedToolResults: mockApplyConfirmedToolResults,
}));

const { POST } = await import("@/app/api/chat/confirm-batch/route");
const { registerPendingAction, clearPendingActions } = await import("@/lib/chat-tools");

const FIRST = { email_id: "a", response_text: "ok" };
const SECOND = { email_id: "b", response_text: "merci" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat/confirm-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat/confirm-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPendingActions();
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockLogActivity.mockResolvedValue(undefined);
    mockRunTool.mockImplementation(async (name: string) => ({
      status: "ok",
      text: `ok:${name}`,
      rendered: `[OK] ok:${name}`,
    }));
  });

  it("refuse sans session", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ actions: [{ name: "send_email_response", arguments: {} }] }));
    expect(res.status).toBe(401);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse un corps sans actions ou actions non confirmables", async () => {
    const empty = await POST(makeRequest({ actions: [] }));
    expect(empty.status).toBe(400);

    const nonConfirmable = await POST(makeRequest({ actions: [{ name: "web_search", arguments: {} }] }));
    expect(nonConfirmable.status).toBe(400);
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse un lot contenant une action jamais proposée, sans rien exécuter", async () => {
    registerPendingAction("send_email_response", FIRST);
    const res = await POST(
      makeRequest({
        actions: [
          { name: "send_email_response", arguments: FIRST },
          { name: "send_email_response", arguments: SECOND },
        ],
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Action non confirmee par le serveur" });
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("refuse un lot avec un doublon, sans exécution partielle", async () => {
    registerPendingAction("send_email_response", FIRST);
    const res = await POST(
      makeRequest({
        actions: [
          { name: "send_email_response", arguments: FIRST },
          { name: "send_email_response", arguments: FIRST },
        ],
      })
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Lot invalide : action en double" });
    expect(mockRunTool).not.toHaveBeenCalled();
  });

  it("exécute toutes les actions proposées et renvoie les résultats", async () => {
    registerPendingAction("send_email_response", FIRST);
    registerPendingAction("send_email_response", SECOND);
    const res = await POST(
      makeRequest({
        actions: [
          { name: "send_email_response", arguments: FIRST },
          { name: "send_email_response", arguments: SECOND },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
    expect(mockRunTool).toHaveBeenCalledTimes(2);
    expect(mockRunTool).toHaveBeenCalledWith("send_email_response", FIRST, true);
    expect(mockRunTool).toHaveBeenCalledWith("send_email_response", SECOND, true);
    expect(mockLogActivity).toHaveBeenCalledTimes(2);
  });

  it("exécute un lot d'écritures mises en attente pour cause de provenance", async () => {
    // Issue #124 : ces outils ne demandent pas de confirmation permanente mais
    // ont été bloqués dans un tour contaminé. La confirmation doit les lancer.
    const reminder = { title: "Relancer", dueAt: "2026-11-27" };
    const issue = { title: "Bug", body: "Corps" };
    registerPendingAction("add_reminder", reminder, "provenance");
    registerPendingAction("create_github_issue", issue, "provenance");
    const res = await POST(
      makeRequest({
        actions: [
          { name: "add_reminder", arguments: reminder },
          { name: "create_github_issue", arguments: issue },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { name: string }) => r.name)).toEqual([
      "add_reminder",
      "create_github_issue",
    ]);
    expect(mockRunTool).toHaveBeenCalledWith("add_reminder", reminder, true);
    expect(mockRunTool).toHaveBeenCalledWith("create_github_issue", issue, true);
  });

  it("reporte le résultat réel sur l'historique quand le client fournit session et appels", async () => {
    registerPendingAction("add_memory_fact", { content: "Aime le the" });
    const res = await POST(
      makeRequest({
        sessionId: "s-memoire",
        actions: [
          {
            name: "add_memory_fact",
            arguments: { content: "Aime le the" },
            toolCallId: "tc-1",
          },
        ],
      })
    );
    expect(res.status).toBe(200);
    // Le texte d'avant confirmation ne doit plus jamais être rejoué : le
    // résultat serveur remplace le [BLOQUE] de l'historique (issue #141).
    expect(mockApplyConfirmedToolResults).toHaveBeenCalledWith("s-memoire", [
      { toolCallId: "tc-1", status: "ok", result: "ok:add_memory_fact" },
    ]);
  });

  it("refuse de rejouer un lot déjà exécuté", async () => {
    registerPendingAction("send_email_response", FIRST);
    registerPendingAction("send_email_response", SECOND);
    const actions = [
      { name: "send_email_response", arguments: FIRST },
      { name: "send_email_response", arguments: SECOND },
    ];
    const first = await POST(makeRequest({ actions }));
    expect(first.status).toBe(200);
    const replay = await POST(makeRequest({ actions }));
    expect(replay.status).toBe(400);
    expect(mockRunTool).toHaveBeenCalledTimes(2);
  });

  it("marque en echec un résultat texte sans exception (statut non OK)", async () => {
    // « Rappel introuvable. » ne lève rien : sans statut, le lot serait
    // affiché comme un succès alors que rien n'a été fait.
    registerPendingAction("send_email_response", FIRST);
    mockRunTool.mockResolvedValue({
      status: "error",
      text: "Rappel introuvable.",
      rendered: "[ERREUR] Rappel introuvable.",
    });
    const res = await POST(
      makeRequest({ actions: [{ name: "send_email_response", arguments: FIRST }] })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].status).toBe("error");
    expect(body.results[0].error).toBe("Rappel introuvable.");
  });

  it("continue le lot et marque en échec une action qui échoue", async () => {
    const BAD = { email_id: "bad", response_text: "x" };
    registerPendingAction("send_email_response", BAD);
    registerPendingAction("send_email_response", FIRST);
    mockRunTool.mockImplementation(async (name: string, args: { email_id?: string }) => {
      if (args?.email_id === "bad") {
        return { status: "error", text: "boom", rendered: "[ERREUR] boom" };
      }
      return { status: "ok", text: "ok", rendered: "[OK] ok" };
    });
    const res = await POST(
      makeRequest({
        actions: [
          { name: "send_email_response", arguments: BAD },
          { name: "send_email_response", arguments: FIRST },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toEqual({ name: "send_email_response", ok: false, status: "error", error: "boom" });
    expect(body.results[1].ok).toBe(true);
    expect(mockRunTool).toHaveBeenCalledTimes(2);
    expect(mockLogActivity).toHaveBeenCalledTimes(2);
  });

  it("répond 400 sur un corps invalide", async () => {
    const res = await POST(new Request("http://localhost/api/chat/confirm-batch", { method: "POST", body: "pas du json" }));
    expect(res.status).toBe(400);
    expect(mockRunTool).not.toHaveBeenCalled();
  });
});
