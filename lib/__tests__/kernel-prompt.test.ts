import { describe, expect, it, vi } from "vitest";

import {
  PROMPT_BLOCK_BUDGET,
  PROMPT_TOTAL_BUDGET,
  renderModulePrompts,
  truncatePromptBlock,
} from "@/lib/kernel/prompt";
import { createRegistry } from "@/lib/kernel/registry-core";
import type { ModuleContext, ModuleDefinition, PromptContribution } from "@backstage/module-kit";

const ctx = {} as ModuleContext;

function moduleWith(id: string, prompts: PromptContribution[] = []): ModuleDefinition {
  return {
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: `Module ${id}`,
    selectionDescription: "Description courte.",
    description: "Description longue.",
    prompt: prompts,
  };
}

function prompt(id: string, priority: number, render: PromptContribution["render"]): PromptContribution {
  return { id, priority, render };
}

function render(registry: ReturnType<typeof createRegistry>, options = {}) {
  return renderModulePrompts(registry, {
    contextFor: () => ctx,
    log: vi.fn(),
    ...options,
  });
}

describe("blocs de prompt des modules", () => {
  it("ordonne par priorite decroissante", async () => {
    const registry = createRegistry([
      moduleWith("a", [prompt("bas", 10, async () => "bas")]),
      moduleWith("b", [prompt("haut", 90, async () => "haut")]),
    ]);
    expect(await render(registry)).toBe("haut\n\nbas");
  });

  it("tronque chaque bloc au budget par bloc", async () => {
    const registry = createRegistry([moduleWith("a", [prompt("long", 10, async () => "x".repeat(500))])]);
    const block = await render(registry);
    expect(block.length).toBe(PROMPT_BLOCK_BUDGET);
    expect(block.endsWith("…")).toBe(true);
  });

  it("arrete quand le budget total est epuise", async () => {
    const registry = createRegistry([
      moduleWith("a", [prompt("un", 90, async () => "a".repeat(100))]),
      moduleWith("b", [prompt("deux", 10, async () => "b".repeat(100))]),
    ]);
    const blocks = (await render(registry, { totalBudget: 150, blockBudget: 100 })).split("\n\n");
    expect(blocks.map((block) => block.length)).toEqual([100, 50]);
  });

  it("retire le bloc qui leve et continue le tour", async () => {
    const log = vi.fn();
    const registry = createRegistry([
      moduleWith("a", [
        prompt("casse", 90, async () => {
          throw new Error("panne");
        }),
      ]),
      moduleWith("b", [prompt("ok", 10, async () => "contenu")]),
    ]);

    await expect(render(registry, { log })).resolves.toBe("contenu");
    expect(log).toHaveBeenCalledWith(
      "warn",
      '[prompt] bloc "a.casse" ignore',
      expect.any(Error)
    );
  });

  it("ignore les blocs vides et les modules desactives", async () => {
    const registry = createRegistry(
      [
        moduleWith("a", [prompt("vide", 90, async () => "   ")]),
        moduleWith("b", [prompt("actif", 10, async () => "contenu")]),
      ],
      { enabled: ["b"] }
    );
    expect(await render(registry)).toBe("contenu");
  });

  it("ne depasse jamais le budget global", async () => {
    const registry = createRegistry([
      moduleWith("a", [prompt("un", 90, async () => "a".repeat(400))]),
      moduleWith("b", [prompt("deux", 80, async () => "b".repeat(400))]),
      moduleWith("c", [prompt("trois", 70, async () => "c".repeat(400))]),
      moduleWith("d", [prompt("quatre", 60, async () => "d".repeat(400))]),
    ]);
    const result = await render(registry);
    expect(result.replace(/\n\n/g, "").length).toBeLessThanOrEqual(PROMPT_TOTAL_BUDGET);
  });
});

describe("truncatePromptBlock", () => {
  it("laisse intact un texte sous la limite", () => {
    expect(truncatePromptBlock("court", 10)).toBe("court");
  });

  it("coupe proprement et signale la troncature", () => {
    expect(truncatePromptBlock("abcdefghij", 6)).toBe("abcde…");
  });

  it("rend une chaine vide avec un budget nul", () => {
    expect(truncatePromptBlock("abc", 0)).toBe("");
  });
});
