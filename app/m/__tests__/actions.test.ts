import { beforeEach, describe, expect, it, vi } from "vitest";

const kernel = { kernelAction: vi.fn() };

vi.mock("@/lib/kernel/actions", () => kernel);

const { callModuleAction } = await import("@/app/m/actions");

describe("invocation generique d'une action de module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kernel.kernelAction.mockResolvedValue("ok");
  });

  it("prefixe l'action par l'identifiant du module", async () => {
    await callModuleAction("watch-later", "create", { url: "https://example.com" });
    expect(kernel.kernelAction).toHaveBeenCalledWith("watch-later.create", {
      url: "https://example.com",
    });
  });

  it("transmet l'entree telle quelle, sans validation locale", async () => {
    await callModuleAction("watch-later", "remove", { id: "1" });
    expect(kernel.kernelAction).toHaveBeenCalledWith("watch-later.remove", { id: "1" });
  });

  it("propage l'erreur du noyau (session, action inconnue, validation)", async () => {
    kernel.kernelAction.mockRejectedValue(new Error("Non authentifie"));
    await expect(callModuleAction("watch-later", "load", {})).rejects.toThrow(
      "Non authentifie"
    );
  });
});
