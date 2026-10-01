import { beforeEach, describe, expect, it, vi } from "vitest";

// Certains modèles du catalogue (muse-spark-*-contributor) refusent
// chat.completions et n'acceptent que l'API Responses.
const { chatOpenAI, responsesOpenAI } = vi.hoisted(() => ({
  chatOpenAI: vi.fn(),
  responsesOpenAI: vi.fn(),
}));

vi.mock("@/lib/ai-providers/openai", () => ({
  chatOpenAI,
  responsesOpenAI,
  streamOpenAI: vi.fn(),
}));

vi.mock("@/lib/ai-providers/anthropic", () => ({
  chatAnthropic: vi.fn(),
  streamAnthropic: vi.fn(),
}));

const { chatCompletion } = await import("@/lib/ai-providers");

const messages = [{ role: "user" as const, content: "salut" }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chatCompletion — repli vers l'API Responses", () => {
  it("bascule quand le modèle refuse chat.completions", async () => {
    chatOpenAI.mockRejectedValueOnce(
      new Error("400 Model does not support this protocol.")
    );
    responsesOpenAI.mockResolvedValueOnce({ content: '{"tool":"none"}', toolCalls: [] });

    const result = await chatCompletion("muse-spark-1.3-contributor", messages, []);

    expect(result.content).toBe('{"tool":"none"}');
    expect(responsesOpenAI).toHaveBeenCalledTimes(1);
  });

  it("ne bascule pas sur une autre erreur (timeout, quota)", async () => {
    chatOpenAI.mockRejectedValueOnce(new Error("Request timed out."));

    await expect(
      chatCompletion("deepseek-v4-flash", messages, [])
    ).rejects.toThrow("timed out");
    expect(responsesOpenAI).not.toHaveBeenCalled();
  });

  it("ne tente pas Responses si des tools sont passes", async () => {
    chatOpenAI.mockRejectedValueOnce(
      new Error("Model does not support this protocol.")
    );

    await expect(
      chatCompletion("muse-spark-1.3-contributor", messages, [
        { name: "get_schedule", description: "x", parameters: {} },
      ])
    ).rejects.toThrow("protocol");
    expect(responsesOpenAI).not.toHaveBeenCalled();
  });
});