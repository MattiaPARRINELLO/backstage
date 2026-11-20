import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockRequireSession = vi.fn();
vi.mock("@/lib/session", () => ({ requireSession: mockRequireSession }));

const { runAction } = await import("@/lib/action");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSession.mockResolvedValue({ userId: "owner" });
});

describe("runAction", () => {
  it("valide l'entree et transmet la session", async () => {
    const handler = vi.fn(async (data: { title: string }, session: { userId: string }) => ({
      title: data.title,
      userId: session.userId,
    }));

    const result = await runAction(
      z.object({ title: z.string().trim().min(1, "Titre requis") }),
      { title: "  Rapport  " },
      handler
    );

    expect(result).toEqual({ title: "Rapport", userId: "owner" });
  });

  it("refuse une entree invalide avec le message du schema", async () => {
    const handler = vi.fn();

    await expect(
      runAction(z.object({ title: z.string().min(1, "Titre requis") }), { title: "" }, handler)
    ).rejects.toMatchObject({ code: "validation", message: "Titre requis" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuse sans session avant meme de valider", async () => {
    const error = new Error("Non authentifié");
    error.name = "AppError";
    mockRequireSession.mockRejectedValue(error);

    await expect(runAction(z.object({}), {}, vi.fn())).rejects.toThrow("Non authentifié");
  });
});
