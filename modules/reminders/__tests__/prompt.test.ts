import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = { getReminders: vi.fn() };

vi.mock("@/lib/storage", () => storage);

const { upcomingRemindersPrompt } = await import("@/modules/reminders/prompt");

const ctx = { moduleId: "reminders", log: () => {}, emit: () => {} };

function reminder(id: string, title: string, dueAt: string, status = "pending") {
  return { id, title, dueAt, status };
}

describe("bloc de prompt des rappels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cite les cinq prochains rappels pending, tries par echeance", async () => {
    storage.getReminders.mockResolvedValue({
      reminders: [
        reminder("6", "Sixieme", "2026-11-25T10:00:00.000Z"),
        reminder("1", "Premier", "2026-11-20T10:00:00.000Z"),
        reminder("2", "Deuxieme", "2026-11-21T10:00:00.000Z"),
        reminder("3", "Troisieme", "2026-11-22T10:00:00.000Z"),
        reminder("4", "Quatrieme", "2026-11-23T10:00:00.000Z"),
        reminder("5", "Cinquieme", "2026-11-24T10:00:00.000Z"),
      ],
    });

    const text = await upcomingRemindersPrompt.render(ctx);

    expect(text.startsWith("Rappels en attente :")).toBe(true);
    expect(text).toContain("Premier");
    expect(text).toContain("Cinquieme");
    expect(text).not.toContain("Sixieme");
    expect(text.indexOf("Premier")).toBeLessThan(text.indexOf("Deuxieme"));
  });

  it("ignore les rappels termines", async () => {
    storage.getReminders.mockResolvedValue({
      reminders: [
        reminder("1", "Fait", "2026-11-20T10:00:00.000Z", "done"),
        reminder("2", "En cours", "2026-11-21T10:00:00.000Z"),
      ],
    });

    const text = await upcomingRemindersPrompt.render(ctx);
    expect(text).toContain("En cours");
    expect(text).not.toContain("Fait");
  });

  it("ne rend rien sans rappel en attente", async () => {
    storage.getReminders.mockResolvedValue({ reminders: [] });
    expect(await upcomingRemindersPrompt.render(ctx)).toBe("");
  });
});
