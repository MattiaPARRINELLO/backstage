import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  addIntention: vi.fn(),
  getIntentions: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { scheduleFollowupTool } = await import("@/modules/followups/tools");

const ctx = { moduleId: "followups", log: () => {}, emit: () => {} };

const intention = {
  id: "i1",
  subject: "le dossier UX",
  dueAt: "2026-11-27T18:00:00.000Z",
  status: "pending",
};

describe("outil relance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.addIntention.mockResolvedValue(intention);
    storage.getIntentions.mockResolvedValue({ intentions: [intention] });
  });

  it("programme une relance et confirme par relecture", async () => {
    const result = await scheduleFollowupTool.run(
      { subject: "le dossier UX", due_at: "2026-11-27T18:00:00" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Relance programmee");
    expect(storage.addIntention).toHaveBeenCalledWith({
      subject: "le dossier UX",
      message: undefined,
      dueAt: "2026-11-27T18:00:00",
    });
  });

  it("signale un echec si la relecture ne retrouve pas la relance", async () => {
    storage.getIntentions.mockResolvedValue({ intentions: [] });
    const result = await scheduleFollowupTool.run(
      { subject: "le dossier UX", due_at: "2026-11-27T18:00:00" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("ecriture non confirmee");
  });

  it("rejette une echeance invalide", () => {
    const parsed = scheduleFollowupTool.params.safeParse({
      subject: "Relance",
      due_at: "pas-une-date",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Echeance invalide");
  });
});
