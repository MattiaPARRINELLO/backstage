import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = { logActivity: vi.fn() };
const web = { isSafeFetchUrl: vi.fn(), safeFetchText: vi.fn() };
const ai = { chatCompletion: vi.fn() };
const appConfig = { getConfig: vi.fn(), getModel: vi.fn() };
const googleActions = {
  fetchGmailThreads: vi.fn(),
  fetchGmailThread: vi.fn(),
  fetchGmailMessage: vi.fn(),
};
const push = { sendPushToAll: vi.fn() };

vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/web", () => web);
vi.mock("@/lib/ai-providers", () => ai);
vi.mock("@/lib/app-config", () => appConfig);
vi.mock("@/lib/google-actions", () => googleActions);
vi.mock("@/lib/push-dispatch", () => push);

const { createModuleContext } = await import("@/lib/kernel/context");

describe("contexte de module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appConfig.getModel.mockResolvedValue({
      primary: "modele-general",
      alt: "modele-general",
    });
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
    expect(appConfig.getModel).toHaveBeenCalled();
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

  it("envoie une notification par le canal du noyau", async () => {
    push.sendPushToAll.mockResolvedValue({ sent: true, devices: 1 });
    const ctx = createModuleContext("demo");
    await expect(
      ctx.notify?.({ title: "Relance", body: "Echeance", url: "/m/demo", tag: "a1" })
    ).resolves.toBe(true);
    const payload = JSON.parse(push.sendPushToAll.mock.calls[0][0]);
    expect(payload).toMatchObject({
      title: "Relance",
      body: "Echeance",
      tag: "a1",
      data: { url: "/m/demo" },
    });
  });

  it("rend false quand aucune notification n'est delivree", async () => {
    push.sendPushToAll.mockResolvedValue({ sent: false, devices: 0 });
    const ctx = createModuleContext("demo");
    await expect(ctx.notify?.({ title: "t", body: "b" })).resolves.toBe(false);
  });

  it("delegue le mail aux actions Google du noyau", async () => {
    googleActions.fetchGmailThreads.mockResolvedValue([{ id: "t1", messages: [] }]);
    googleActions.fetchGmailThread.mockResolvedValue({ id: "t1", messages: [] });
    googleActions.fetchGmailMessage.mockResolvedValue(null);
    const ctx = createModuleContext("demo");
    await ctx.mail?.listThreads("accreditation", 5);
    await ctx.mail?.getThread("t1");
    await ctx.mail?.getMessage("m1");
    expect(googleActions.fetchGmailThreads).toHaveBeenCalledWith("accreditation", 5);
    expect(googleActions.fetchGmailThread).toHaveBeenCalledWith("t1");
    expect(googleActions.fetchGmailMessage).toHaveBeenCalledWith("m1");
  });
});
