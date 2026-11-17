import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const registry = { tool: vi.fn() };
const context = { createModuleContext: vi.fn(() => ({ moduleId: "reminders", log: () => {}, emit: () => {} })) };

vi.mock("@/lib/kernel/registry", () => ({ registry }));
vi.mock("@/lib/kernel/context", () => context);

const { isModuleTool, moduleTools, resolveModuleTool, runModuleTool } = await import(
  "@/lib/kernel/tool-bridge"
);

const definition = {
  name: "add",
  description: "Cree un rappel.",
  params: z.object({ title: z.string().min(1, "Titre requis"), status: z.enum(["pending", "done"]).optional() }),
  sideEffect: "write" as const,
  requiresConfirmation: false,
  confirmable: true,
  untrusted: false,
  run: vi.fn(),
};

const registered = {
  name: "reminders.add",
  moduleId: "reminders",
  definition,
  requiresConfirmation: false,
  confirmable: true,
  untrusted: false,
};

describe("pont des outils de module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.tool.mockImplementation((name: string) =>
      name === "reminders.add" ? registered : undefined
    );
  });

  it("resout un nom qualifie", () => {
    expect(resolveModuleTool("reminders.add")).toBe(registered);
  });

  it("resout un ancien nom par la table de correspondance", () => {
    expect(resolveModuleTool("add_reminder")).toBe(registered);
    expect(registry.tool).toHaveBeenCalledWith("reminders.add");
  });

  it("ne resout pas un outil du noyau", () => {
    expect(resolveModuleTool("web_search")).toBeUndefined();
    expect(isModuleTool("web_search")).toBe(false);
    expect(isModuleTool("add_reminder")).toBe(true);
  });

  it("expose les outils du registre au format des providers", () => {
    registry.tool.mockReturnValue(registered);
    const fakeRegistry = {
      tools: [registered],
    };
    // `moduleTools` lit `registry.tools`, absent du mock ci-dessus : on le pose.
    (registry as unknown as { tools: unknown }).tools = fakeRegistry.tools;

    const [tool] = moduleTools();
    expect(tool?.name).toBe("reminders.add");
    expect(tool?.parameters).toMatchObject({ type: "object" });
    expect(tool?.parameters).not.toHaveProperty("$schema");
    expect(
      (tool?.parameters as { properties: Record<string, unknown> }).properties
    ).toHaveProperty("title");
  });

  it("refuse des arguments hors schema, sans executer", async () => {
    const result = await runModuleTool(registered, { title: "" });
    expect(result.status).toBe("error");
    expect(result.text).toContain("Titre requis");
    expect(definition.run).not.toHaveBeenCalled();
  });

  it("transmet le statut du module, sans le deduire du texte", async () => {
    definition.run.mockResolvedValue({ status: "error", text: "Rappel introuvable." });
    const result = await runModuleTool(registered, { title: "Appeler" });
    expect(result).toEqual({ status: "error", text: "Rappel introuvable." });
  });

  it("convertit une exception en statut error", async () => {
    definition.run.mockRejectedValue(new Error("disque plein"));
    const result = await runModuleTool(registered, { title: "Appeler" });
    expect(result.status).toBe("error");
    expect(result.text).toContain("disque plein");
  });
});
