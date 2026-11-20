import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const session = { requireSession: vi.fn() };
const cache = { revalidatePath: vi.fn() };
const storage = { logActivity: vi.fn() };
const registryModule = { registry: { requireAction: vi.fn() } };

vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => cache);
vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/kernel/registry", () => registryModule);

const { kernelAction } = await import("@/lib/kernel/actions");

const run = vi.fn(async (input: { title: string }, ctx: { userId?: string }) => ({
  title: input.title,
  userId: ctx.userId,
}));

const entry = {
  moduleId: "reminders",
  definition: {
    name: "create",
    input: z.object({ title: z.string().trim().min(1, "Titre requis") }),
    revalidate: ["/reminders", "/today"],
    run,
  },
};

function authenticated() {
  session.requireSession.mockResolvedValue({ userId: "user-1" });
}

describe("kernelAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registryModule.registry.requireAction.mockReturnValue(entry);
    authenticated();
  });

  it("exige une session avant tout le reste", async () => {
    session.requireSession.mockRejectedValue(new Error("Non authentifie"));
    await expect(kernelAction("reminders.create", { title: "x" })).rejects.toThrow(
      "Non authentifie"
    );
    expect(registryModule.registry.requireAction).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("refuse une action inconnue", async () => {
    registryModule.registry.requireAction.mockImplementation(() => {
      throw new Error('Action "reminders.absent" inconnue');
    });
    await expect(kernelAction("reminders.absent", {})).rejects.toThrow(/inconnue/);
    expect(run).not.toHaveBeenCalled();
  });

  it("valide l'entree et rend le premier message Zod", async () => {
    await expect(kernelAction("reminders.create", { title: "   " })).rejects.toThrow(
      "Titre requis"
    );
    expect(run).not.toHaveBeenCalled();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("journalise la duree totale et celle de l'etape run", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await kernelAction("reminders.create", { title: "Appeler" });

      const lines = info.mock.calls.map((call) => JSON.parse(String(call[0])) as {
        msg: string;
        module: string;
        durationMs?: number;
      });
      expect(lines.some((line) => line.msg === "reminders.create")).toBe(true);
      expect(lines.some((line) => line.msg === "reminders.create.run")).toBe(true);
      expect(lines.every((line) => line.module === "action")).toBe(true);
      expect(lines.every((line) => (line.durationMs ?? -1) >= 0)).toBe(true);
    } finally {
      info.mockRestore();
    }
  });

  it("transmet l'utilisateur et le contexte du noyau", async () => {
    const result = await kernelAction("reminders.create", { title: "  Appeler  " });
    expect(result).toEqual({ title: "Appeler", userId: "user-1" });
    expect(run).toHaveBeenCalledWith(
      { title: "Appeler" },
      expect.objectContaining({
        moduleId: "reminders",
        userId: "user-1",
        log: expect.any(Function),
        emit: expect.any(Function),
        activity: expect.any(Function),
      })
    );
  });

  it("revalide apres l'execution, dans l'ordre declare", async () => {
    await kernelAction("reminders.create", { title: "Appeler" });
    expect(cache.revalidatePath.mock.calls).toEqual([["/reminders"], ["/today"]]);
  });

  it("ne revalide rien si l'action echoue", async () => {
    run.mockRejectedValueOnce(new Error("Ecriture refusee"));
    await expect(kernelAction("reminders.create", { title: "Appeler" })).rejects.toThrow(
      "Ecriture refusee"
    );
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("accepte une entree absente pour une action sans parametre", async () => {
    registryModule.registry.requireAction.mockReturnValue({
      moduleId: "reminders",
      definition: { name: "load", input: z.object({}), run: vi.fn(async () => "ok") },
    });
    await expect(kernelAction("reminders.load", undefined)).resolves.toBe("ok");
  });
});
