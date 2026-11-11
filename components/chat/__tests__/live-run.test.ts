/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  api: {
    chat: {
      stream: mocks.stream,
      resume: mocks.resume,
      stop: mocks.stop,
    },
  },
}));

import {
  startLiveRun,
  getLiveRun,
  isNetworkError,
  type LiveRunEvent,
} from "@/components/chat/live-run";

const userMessage = {
  id: "u1",
  role: "user" as const,
  content: "Salut",
  timestamp: new Date(0).toISOString(),
};

async function waitFor(predicate: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function eventsOf(sessionId: string): LiveRunEvent[] {
  return getLiveRun(sessionId)?.events ?? [];
}

describe("live-run", () => {
  beforeEach(() => {
    mocks.stream.mockReset();
    mocks.resume.mockReset();
    mocks.stop.mockReset();
  });

  it("ne remonte jamais le « Failed to fetch » brut d'une coupure réseau", async () => {
    mocks.stream.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.resume.mockImplementationOnce(async (_id: string, onEvent: (e: LiveRunEvent) => void) => {
      onEvent({
        type: "snapshot",
        sessionId: "s-reseau",
        content: "Réponse complète",
        tools: [],
        activeTools: [],
        groups: [],
        error: null,
        finished: true,
        doneContent: "Réponse complète",
      });
      onEvent({ type: "done", content: "Réponse complète" });
      return true;
    });

    startLiveRun({
      sessionId: "s-reseau",
      userMessage,
      messages: [{ role: "user", content: "Salut" }],
    });

    await waitFor(() => getLiveRun("s-reseau")?.status === "done");

    const events = eventsOf("s-reseau");
    expect(events.some((e) => e.type === "done")).toBe(true);
    expect(events.some((e) => e.type === "failed")).toBe(false);
    expect(JSON.stringify(events)).not.toContain("Failed to fetch");
    expect(mocks.resume).toHaveBeenCalledTimes(1);
  });

  it("signale un envoi qui n'a jamais atteint le serveur", async () => {
    mocks.stream.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mocks.resume.mockResolvedValueOnce(false);

    startLiveRun({
      sessionId: "s-jamais",
      userMessage,
      messages: [{ role: "user", content: "Salut" }],
    });

    await waitFor(() => getLiveRun("s-jamais")?.status === "error");

    const failed = eventsOf("s-jamais").find((e) => e.type === "failed");
    expect(failed).toMatchObject({ type: "failed" });
    if (failed?.type === "failed") {
      expect(failed.message).toContain("Impossible de joindre le serveur");
    }
  });

  it("conserve le message d'une erreur applicative du serveur", async () => {
    mocks.stream.mockRejectedValueOnce(new Error("Quota IA dépassé"));

    startLiveRun({
      sessionId: "s-app",
      userMessage,
      messages: [{ role: "user", content: "Salut" }],
    });

    await waitFor(() => getLiveRun("s-app")?.status === "error");

    const failed = eventsOf("s-app").find((e) => e.type === "failed");
    expect(failed).toEqual({ type: "failed", message: "Quota IA dépassé" });
    expect(mocks.resume).not.toHaveBeenCalled();
  });

  it("reconnaît les erreurs réseau", () => {
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource"))).toBe(
      true
    );
    expect(isNetworkError(new Error("Quota IA dépassé"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
