import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = { logActivity: vi.fn() };
const web = { isSafeFetchUrl: vi.fn(), safeFetchText: vi.fn() };
const ai = { chatCompletion: vi.fn() };
const appConfig = { getConfig: vi.fn() };

vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/web", () => web);
vi.mock("@/lib/ai-providers", () => ai);
vi.mock("@/lib/app-config", () => appConfig);

const { createModuleContext } = await import("@/lib/kernel/context");

describe("contexte de module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appConfig.getConfig.mockResolvedValue({ models: { general: "modele-general" } });
  });

  it("journalise l'activite par le journal du noyau", async () => {
    const ctx = createModuleContext("watch-later");
    await ctx.activity?.("watch_later_added", "Lien ajoute", "https://example.com");
    expect(storage.logActivity).toHaveBeenCalledWith(
      "watch_later_added",
      "Lien ajoute",
      "https://example.com"
    );
  });

  it("expose le controle anti-SSRF du noyau", async () => {
    web.isSafeFetchUrl.mockResolvedValue(true);
    const ctx = createModuleContext("watch-later");
    await expect(ctx.net?.isSafeUrl("https://example.com")).resolves.toBe(true);
    expect(web.isSafeFetchUrl).toHaveBeenCalledWith("https://example.com");
  });

  it("rend null quand le fetch controle echoue, sans lever", async () => {
    web.safeFetchText.mockRejectedValue(new Error("URL refusee"));
    const ctx = createModuleContext("watch-later");
    await expect(ctx.net?.fetchText("http://127.0.0.1")).resolves.toBeNull();
  });

  it("rend le texte du fetch controle quand il aboutit", async () => {
    web.safeFetchText.mockResolvedValue("<html>ok</html>");
    const ctx = createModuleContext("watch-later");
    await expect(ctx.net?.fetchText("https://example.com", 5000)).resolves.toBe(
      "<html>ok</html>"
    );
    expect(web.safeFetchText).toHaveBeenCalledWith("https://example.com", 5000);
  });

  it("complete avec le modele applicatif et tronque", async () => {
    ai.chatCompletion.mockResolvedValue({ content: "a".repeat(50) });
    const ctx = createModuleContext("watch-later");
    const text = await ctx.ai?.complete({
      system: "Tu resumes.",
      prompt: "Un long texte",
      maxChars: 10,
    });
    expect(text).toBe("a".repeat(10));
    expect(appConfig.getConfig).toHaveBeenCalled();
    expect(ai.chatCompletion).toHaveBeenCalledWith(
      "modele-general",
      [
        { role: "system", content: "Tu resumes." },
        { role: "user", content: "Un long texte" },
      ],
      []
    );
  });

  it("complete sans consigne systeme", async () => {
    ai.chatCompletion.mockResolvedValue({ content: "ok" });
    const ctx = createModuleContext("watch-later");
    await ctx.ai?.complete({ prompt: "Question" });
    expect(ai.chatCompletion).toHaveBeenCalledWith(
      "modele-general",
      [{ role: "user", content: "Question" }],
      []
    );
  });
});
