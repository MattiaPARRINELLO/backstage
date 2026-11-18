import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const TEST_DIR = path.join(os.tmpdir(), "backstage-test-confirmation-state-" + Date.now());
const originalCwd = process.cwd;

beforeEach(() => {
  process.cwd = () => TEST_DIR;
  fs.mkdirSync(path.join(TEST_DIR, "data"), { recursive: true });
});

afterEach(() => {
  vi.resetModules();
  process.cwd = originalCwd;
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

// Session telle que persistée par le serveur avant confirmation : l'outil
// mémoire y figure encore en attente, avec le texte de blocage.
function sessionWithBlockedMemoryFact() {
  return {
    id: "s-memoire",
    title: "Mémoire",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      { id: "u1", role: "user" as const, content: "Retiens que j'aime le the", timestamp: new Date().toISOString() },
      {
        id: "a1",
        role: "assistant" as const,
        content: "Je dois mémoriser ce fait.",
        timestamp: new Date().toISOString(),
        toolCalls: [
          {
            id: "tc-1",
            name: "add_memory_fact",
            arguments: '{"content":"Aime le the","category":"preference"}',
            result:
              "ACTION_BLOCKED:add_memory_fact. Cette action a un effet externe et exige la confirmation de l'utilisateur.",
            status: "error" as const,
          },
        ],
        steps: [
          {
            kind: "tool" as const,
            id: "tc-1",
            name: "add_memory_fact",
            arguments: '{"content":"Aime le the","category":"preference"}',
            result:
              "ACTION_BLOCKED:add_memory_fact. Cette action a un effet externe et exige la confirmation de l'utilisateur.",
            status: "error" as const,
          },
        ],
      },
    ],
  };
}

describe("état d'une action confirmée", () => {
  it("remplace le [BLOQUE] persistant par le résultat serveur après confirmation", async () => {
    const { saveChatSession, applyConfirmedToolResults, getChatHistory } = await import(
      "@/lib/storage/chat-history"
    );
    const { buildActionContext } = await import("@/lib/chat-action-context");

    await saveChatSession(sessionWithBlockedMemoryFact());
    await applyConfirmedToolResults("s-memoire", [
      { toolCallId: "tc-1", status: "ok", result: "Fait memorise : Aime le the" },
    ]);

    const history = await getChatHistory();
    const message = history.sessions[0]?.messages[1];
    expect(message?.toolCalls?.[0]?.status).toBe("success");
    expect(message?.toolCalls?.[0]?.result).toBe("Fait memorise : Aime le the");
    const step = message?.steps?.[0];
    expect(step?.kind === "tool" ? step.result : undefined).toBe("Fait memorise : Aime le the");
    expect(step?.kind === "tool" ? step.status : undefined).toBe("success");

    const context = buildActionContext(history.sessions[0]!.messages);
    expect(context).toContain("[OK]");
    expect(context).not.toContain("BLOQUE");
  });

  it("rend un dédoublonnage en [VIDE] au lieu d'un blocage", async () => {
    const { saveChatSession, applyConfirmedToolResults, getChatHistory } = await import(
      "@/lib/storage/chat-history"
    );
    const { buildActionContext } = await import("@/lib/chat-action-context");

    await saveChatSession(sessionWithBlockedMemoryFact());
    await applyConfirmedToolResults("s-memoire", [
      {
        toolCallId: "tc-1",
        status: "empty",
        result: "Rien de nouveau : deja en memoire -> Aime le the",
      },
    ]);

    const history = await getChatHistory();
    const message = history.sessions[0]?.messages[1];
    // Un dédoublonnage n'est pas un échec : l'action a bien abouti.
    expect(message?.toolCalls?.[0]?.status).toBe("success");

    const context = buildActionContext(history.sessions[0]!.messages);
    expect(context).toContain("[VIDE]");
    expect(context).not.toContain("BLOQUE");
  });

  it("ne garde qu'une ligne par action : la plus récente fait foi", async () => {
    const { buildActionContext } = await import("@/lib/chat-action-context");

    const context = buildActionContext([
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc-1",
            name: "add_memory_fact",
            arguments: '{"content":"Aime le the"}',
            result: "ACTION_BLOCKED:add_memory_fact.",
            status: "error",
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "tc-2",
            name: "add_memory_fact",
            arguments: '{"content":"Aime le the"}',
            result: "Rien de nouveau : deja en memoire -> Aime le the",
            status: "success",
          },
        ],
      },
    ]);

    expect(context.split("\n")).toHaveLength(1);
    expect(context).toContain("[VIDE]");
    expect(context).not.toContain("BLOQUE");
  });
});
