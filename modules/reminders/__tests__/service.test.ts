import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  getReminders: vi.fn(),
  addReminder: vi.fn(),
  updateReminder: vi.fn(),
  computeNextRecurrence: vi.fn(),
};
const scheduler = { dismissReminderCard: vi.fn() };
const sync = { pushReminderUpdateToMicrosoft: vi.fn() };

vi.mock("@/lib/storage", () => storage);
vi.mock("@/lib/notification-scheduler", () => scheduler);
vi.mock("@/lib/reminder-sync", () => sync);

const {
  completeReminder,
  listPendingReminders,
  pendingReminders,
  recurReminder,
  snoozeReminder,
} = await import("@/modules/reminders/service");

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

describe("completeReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marque fait, propage vers Microsoft et retire la carte", async () => {
    storage.updateReminder.mockResolvedValue(reminder({ status: "done" }));

    await expect(completeReminder("r1")).resolves.toBe(true);

    expect(storage.updateReminder).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ status: "done" })
    );
    expect(sync.pushReminderUpdateToMicrosoft).toHaveBeenCalled();
    expect(scheduler.dismissReminderCard).toHaveBeenCalledWith("r1");
  });

  it("ne propage rien pour un rappel inconnu", async () => {
    storage.updateReminder.mockResolvedValue(null);
    await expect(completeReminder("absent")).resolves.toBe(false);
    expect(sync.pushReminderUpdateToMicrosoft).not.toHaveBeenCalled();
    expect(scheduler.dismissReminderCard).not.toHaveBeenCalled();
  });
});

describe("snoozeReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("reporte de quinze minutes et retire la carte", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:00:00.000Z"));
    storage.updateReminder.mockResolvedValue(reminder({ status: "snoozed" }));

    await expect(snoozeReminder("r1")).resolves.toBe(true);

    expect(storage.updateReminder).toHaveBeenCalledWith("r1", {
      dueAt: "2026-11-17T12:15:00.000Z",
      status: "snoozed",
    });
    expect(scheduler.dismissReminderCard).toHaveBeenCalledWith("r1");
    vi.useRealTimers();
  });

  it("signale un rappel inconnu", async () => {
    storage.updateReminder.mockResolvedValue(null);
    await expect(snoozeReminder("absent")).resolves.toBe(false);
  });
});

describe("pendingReminders", () => {
  const now = new Date("2026-11-17T12:00:00.000Z").getTime();

  it("ne rend que les rappels echus et non traites", () => {
    const data = {
      reminders: [
        reminder({ id: "echu", dueAt: "2026-11-17T11:00:00.000Z" }),
        reminder({ id: "futur", dueAt: "2026-11-18T11:00:00.000Z" }),
        reminder({ id: "fait", dueAt: "2026-11-17T11:00:00.000Z", status: "done" }),
      ],
    };
    expect(pendingReminders(data, now).map((item) => item.id)).toEqual(["echu"]);
  });

  it("laisse une minute de marge pour les notifications", () => {
    const data = {
      reminders: [reminder({ id: "bientot", dueAt: "2026-11-17T12:00:30.000Z" })],
    };
    expect(pendingReminders(data, now)).toHaveLength(1);
  });

  it("liste en lecture les rappels echus", async () => {
    storage.getReminders.mockResolvedValue({
      reminders: [reminder({ dueAt: "2020-01-01T00:00:00.000Z" })],
    });
    const pending = await listPendingReminders();
    expect(pending).toHaveLength(1);
  });
});
