import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  getReminders: vi.fn(),
  addReminder: vi.fn(),
  computeNextRecurrence: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { recurReminder } = await import("@/modules/reminders/service");

function reminder(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    title: "Arroser les plantes",
    dueAt: "2026-11-17T10:00:00.000Z",
    status: "pending",
    createdAt: "2026-11-17T10:00:00.000Z",
    recurrence: "weekly",
    ...overrides,
  };
}

describe("recurReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree le rappel suivant a l'echeance calculee", async () => {
    storage.getReminders.mockResolvedValue({ reminders: [reminder()] });
    storage.computeNextRecurrence.mockReturnValue("2026-11-24T10:00:00.000Z");

    const result = await recurReminder("r1");

    expect(result).toEqual({ ok: true, nextDue: "2026-11-24T10:00:00.000Z" });
    expect(storage.computeNextRecurrence).toHaveBeenCalledWith(
      "2026-11-17T10:00:00.000Z",
      "weekly"
    );
    expect(storage.addReminder).toHaveBeenCalledWith({
      title: "Arroser les plantes",
      notes: undefined,
      dueAt: "2026-11-24T10:00:00.000Z",
      recurrence: "weekly",
    });
  });

  it("signale un rappel inconnu, sans rien creer", async () => {
    storage.getReminders.mockResolvedValue({ reminders: [] });
    const result = await recurReminder("absent");
    expect(result).toEqual({ ok: false, reason: "Rappel introuvable" });
    expect(storage.addReminder).not.toHaveBeenCalled();
  });

  it("ne cree rien quand le rappel n'a pas de recurrence", async () => {
    storage.getReminders.mockResolvedValue({ reminders: [reminder({ recurrence: undefined })] });
    storage.computeNextRecurrence.mockReturnValue(null);

    const result = await recurReminder("r1");

    expect(result).toEqual({ ok: false, reason: "Pas de récurrence" });
    expect(storage.addReminder).not.toHaveBeenCalled();
  });
});
