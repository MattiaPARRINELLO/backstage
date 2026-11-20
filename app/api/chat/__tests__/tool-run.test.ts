import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ToolRunResult } from "@/lib/chat-tools";

// Politique et execution simulees : ce test verrouille les decisions du module
// (confirmer, executer, echouer), pas le comportement reel des outils.
const mockRunTool = vi.fn();
const mockRegisterPendingAction = vi.fn();
const mockToolPolicy = vi.fn();

vi.mock("@/lib/chat-tools", () => ({
  runTool: mockRunTool,
  registerPendingAction: mockRegisterPendingAction,
  toolPolicy: mockToolPolicy,
}));

const { renderToolResultMessage, runToolCall } = await import("@/app/api/chat/tool-run");

// Politique par defaut : outil de lecture, sans effet de bord ni confirmation.
function policy(overrides: Partial<Record<string, boolean>> = {}) {
  return {
    requiresConfirmation: false,
    confirmable: false,
    write: false,
    untrusted: false,
    ...overrides,
  };
}

const okResult: ToolRunResult = {
  status: "ok",
  text: "résultats web",
  rendered: "[OK] résultats web",
};

describe("runToolCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToolPolicy.mockReturnValue(policy());
    mockRunTool.mockResolvedValue(okResult);
  });

  it("execute un outil de lecture et rend son resultat", async () => {
    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
      false
    );

    expect(mockRunTool).toHaveBeenCalledWith("web_search", { query: "test" });
    expect(mockRegisterPendingAction).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "executed",
      toolCallId: "tc-1",
      name: "web_search",
      result: okResult,
    });
  });

  it("met en attente un outil exigeant une confirmation, sans l'executer", async () => {
    mockToolPolicy.mockReturnValue(policy({ requiresConfirmation: true, write: true }));

    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "send_email_response", arguments: '{"email_id":"a"}' },
      false
    );

    expect(mockRunTool).not.toHaveBeenCalled();
    expect(mockRegisterPendingAction).toHaveBeenCalledWith(
      "send_email_response",
      { email_id: "a" },
      "policy"
    );
    expect(outcome).toEqual({
      kind: "pending",
      toolCallId: "tc-1",
      name: "send_email_response",
      arguments: '{"email_id":"a"}',
      args: { email_id: "a" },
      reason: "policy",
    });
  });

  it("met en attente une ecriture dans un tour contamine par du contenu externe", async () => {
    mockToolPolicy.mockReturnValue(policy({ write: true }));

    const outcome = await runToolCall(
      { toolCallId: "tc-2", name: "update_reminder", arguments: '{"id":"r1"}' },
      true
    );

    expect(mockRunTool).not.toHaveBeenCalled();
    expect(mockRegisterPendingAction).toHaveBeenCalledWith(
      "update_reminder",
      { id: "r1" },
      "provenance"
    );
    expect(outcome.kind).toBe("pending");
    if (outcome.kind !== "pending") return;
    expect(outcome.reason).toBe("provenance");
  });

  it("execute une lecture meme dans un tour contamine", async () => {
    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "fetch_page_meta", arguments: '{"url":"https://example.com"}' },
      true
    );

    expect(mockRunTool).toHaveBeenCalledWith("fetch_page_meta", {
      url: "https://example.com",
    });
    expect(mockRegisterPendingAction).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("executed");
  });

  it("execute une ecriture quand le tour n'est pas contamine", async () => {
    mockToolPolicy.mockReturnValue(policy({ write: true }));

    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "add_reminder", arguments: '{"title":"Appeler"}' },
      false
    );

    expect(mockRunTool).toHaveBeenCalledWith("add_reminder", { title: "Appeler" });
    expect(mockRegisterPendingAction).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("executed");
  });

  it("ne cree ni action en attente ni execution pour des arguments JSON invalides", async () => {
    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "send_email_response", arguments: "{invalide" },
      false
    );

    expect(mockRunTool).not.toHaveBeenCalled();
    expect(mockRegisterPendingAction).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("executed");
    if (outcome.kind !== "executed") return;
    expect(outcome.result).toEqual({
      status: "error",
      text: "Erreur: arguments d'outil invalides (JSON)",
      rendered: "[ERREUR] Erreur: arguments d'outil invalides (JSON)",
    });
  });

  it("refuse un tableau JSON comme arguments", async () => {
    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "web_search", arguments: '["test"]' },
      false
    );

    expect(mockRunTool).not.toHaveBeenCalled();
    expect(outcome.kind).toBe("executed");
    if (outcome.kind !== "executed") return;
    expect(outcome.result.status).toBe("error");
  });

  it("convertit en erreur un echec d'enregistrement de l'action en attente", async () => {
    mockToolPolicy.mockReturnValue(policy({ requiresConfirmation: true }));
    mockRegisterPendingAction.mockImplementation(() => {
      throw new Error("registre indisponible");
    });

    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "send_email_response", arguments: '{"email_id":"a"}' },
      false
    );

    expect(outcome.kind).toBe("executed");
    if (outcome.kind !== "executed") return;
    expect(outcome.result).toEqual({
      status: "error",
      text: "Erreur: registre indisponible",
      rendered: "[ERREUR] Erreur: registre indisponible",
    });
  });

  it("convertit en erreur une exception levee par l'outil", async () => {
    mockRunTool.mockRejectedValue(new Error("boom"));

    const outcome = await runToolCall(
      { toolCallId: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
      false
    );

    expect(outcome.kind).toBe("executed");
    if (outcome.kind !== "executed") return;
    expect(outcome.result.status).toBe("error");
    expect(outcome.result.rendered).toBe("[ERREUR] Erreur: boom");
  });
});

describe("renderToolResultMessage", () => {
  it("delimite le resultat avec son nom et son statut", () => {
    expect(renderToolResultMessage("web_search", okResult)).toBe(
      '<tool_result name="web_search" status="ok">\n[OK] résultats web\n</tool_result>'
    );
  });
});
