import { afterEach, describe, expect, it } from "vitest";
import { chatCompletion, streamChatCompletion } from "@/lib/ai-providers";
import { isMockAiEnabled } from "@/lib/ai-providers/config";
import { fetchModelCatalog, peekAvailableModels } from "@/lib/ai-providers/models";
import { MOCK_CATALOG, MOCK_MODEL } from "@/lib/ai-providers/mock";

const originalProvider = process.env.AI_PROVIDER;

afterEach(() => {
  if (originalProvider === undefined) {
    delete process.env.AI_PROVIDER;
  } else {
    process.env.AI_PROVIDER = originalProvider;
  }
});

describe("fournisseur IA factice", () => {
  it("n'est actif que sur AI_PROVIDER=mock", () => {
    delete process.env.AI_PROVIDER;
    expect(isMockAiEnabled()).toBe(false);
    process.env.AI_PROVIDER = "mock";
    expect(isMockAiEnabled()).toBe(true);
  });

  it("repond sans cle API et sans appel reseau", async () => {
    process.env.AI_PROVIDER = "mock";
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.IA_API_KEY;

    const result = await chatCompletion(
      MOCK_MODEL,
      [{ role: "user", content: "bonjour" }],
      [],
      undefined,
      "test"
    );

    expect(result.toolCalls).toEqual([]);
    expect(result.content).toContain("Mode developpement");
    expect(result.content).toContain("bonjour");
  });

  it("streame des deltas puis un done coherent", async () => {
    process.env.AI_PROVIDER = "mock";

    const events = [];
    for await (const event of streamChatCompletion(
      MOCK_MODEL,
      [{ role: "user", content: "salut" }],
      [],
      undefined,
      "test"
    )) {
      events.push(event);
    }

    const deltas = events.filter((e) => e.type === "delta");
    const done = events.find((e) => e.type === "done");
    expect(deltas.length).toBeGreaterThan(1);
    expect(done && done.type === "done" ? done.content : "").toContain("salut");
  });

  it("expose un catalogue de modeles factice", async () => {
    process.env.AI_PROVIDER = "mock";

    await expect(fetchModelCatalog()).resolves.toEqual(MOCK_CATALOG);
    expect(peekAvailableModels()).toEqual(MOCK_CATALOG.map((m) => m.id));
  });
});
