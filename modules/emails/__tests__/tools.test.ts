import { beforeEach, describe, expect, it, vi } from "vitest";

const google = {
  fetchGmailMessages: vi.fn(),
  sendGmailReply: vi.fn(),
};
const cache = { invalidateServerCachePattern: vi.fn() };

vi.mock("@/lib/google-actions", () => google);
vi.mock("@/lib/server-cache", () => cache);

const { replyEmailTool, searchEmailsTool, triageEmailsTool } = await import("@/modules/emails/tools");

const ctx = { moduleId: "emails", log: () => {}, emit: () => {} };

const email = {
  id: "m1",
  from: "a@b.fr",
  to: "me@b.fr",
  subject: "Accreditation",
  date: "2026-11-18",
  snippet: "Confirme le pass",
  unread: true,
};

describe("outils emails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cherche les emails et rend leur contenu", async () => {
    google.fetchGmailMessages.mockResolvedValue([email]);
    const result = await searchEmailsTool.run({ query: "accred" }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("ID: m1");
    expect(google.fetchGmailMessages).toHaveBeenCalledWith("accred", 10);
  });

  it("rend un resultat vide sans email", async () => {
    google.fetchGmailMessages.mockResolvedValue([]);
    const result = await searchEmailsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("repond a un email et invalide le cache", async () => {
    google.sendGmailReply.mockResolvedValue("sent-1");
    const result = await replyEmailTool.run(
      { email_id: "m1", response_text: "Bonjour" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("sent-1");
    expect(cache.invalidateServerCachePattern).toHaveBeenCalled();
  });

  it("trie les emails urgents", async () => {
    google.fetchGmailMessages.mockResolvedValue([
      { ...email, subject: "URGENT deadline" },
      { ...email, id: "m2", subject: "Newsletter", unread: false },
    ]);
    const result = await triageEmailsTool.run({ max_results: 5 }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("URGENT");
    expect(result.text).toContain("Newsletter");
  });

  it("exige un identifiant et un texte pour repondre", () => {
    expect(replyEmailTool.params.safeParse({ email_id: "", response_text: "x" }).success).toBe(
      false
    );
    expect(replyEmailTool.params.safeParse({ email_id: "m1", response_text: "" }).success).toBe(
      false
    );
  });
});
