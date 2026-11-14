import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const TEST_DIR = path.join(os.tmpdir(), "backstage-test-chat-history-" + Date.now());
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

async function appendAndRead(input: Parameters<
  typeof import("@/lib/storage/chat-history")["appendAssistantTurn"]
>[0]) {
  const { appendAssistantTurn } = await import("@/lib/storage/chat-history");
  await appendAssistantTurn(input);
  const { getChatHistory } = await import("@/lib/storage");
  return getChatHistory();
}

const steps = [
  { kind: "thought" as const, text: "Je cherche les salles." },
  {
    kind: "tool" as const,
    id: "t1",
    name: "web_search",
    arguments: '{"query":"salles Paris"}',
    result: "La Cigale",
    status: "success" as const,
    duration: 1.2,
    resultCount: 1,
  },
];

describe("chat-history - fil d'activité", () => {
  it("persiste les étapes et la durée du tour avec la réponse", async () => {
    const history = await appendAndRead({
      sessionId: "s-fil",
      userContent: "Où jouer ?",
      assistantContent: "À La Cigale.",
      steps,
      activityMs: 4_200,
    });

    const message = history.sessions[0]?.messages.at(-1);
    expect(message?.role).toBe("assistant");
    expect(message?.steps).toEqual(steps);
    expect(message?.activityMs).toBe(4_200);
  });

  it("ne crée pas de doublon quand le client a déjà sauvegardé la réponse", async () => {
    await appendAndRead({
      sessionId: "s-doublon",
      userContent: "Salut",
      assistantContent: "Bonjour.",
      steps,
    });

    const history = await appendAndRead({
      sessionId: "s-doublon",
      userContent: "Salut",
      assistantContent: "Bonjour.",
      steps,
    });

    const assistants = history.sessions[0]?.messages.filter(
      (m) => m.role === "assistant"
    );
    expect(assistants).toHaveLength(1);
  });
});
