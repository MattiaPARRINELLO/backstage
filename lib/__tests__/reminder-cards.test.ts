import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Les rappels suivent la même règle que les cours : carte promue 1 h avant
// l'échéance, une seule fois, fermée quand le rappel est traité (fait,
// supprimé, reporté) ou s'il n'est plus en attente.
const store = new Map<string, unknown>();
const sent: { title: string; tag?: string; dismiss?: boolean; progress?: number; progressMax?: number }[] = [];

type FakeReminder = {
  id: string;
  title: string;
  notes?: string;
  dueAt: string;
  status: "pending" | "done" | "snoozed";
};

const state: { reminders: FakeReminder[] } = { reminders: [] };

function at(hour: number, minute = 0): number {
  return new Date(2026, 10, 4, hour, minute, 0, 0).getTime();
}

vi.mock("@/lib/storage", () => ({
  getReminders: vi.fn(async () => ({ reminders: state.reminders })),
  getCourses: vi.fn(async () => []),
  getCoursesStartingSoon: vi.fn(() => []),
  courseNotifKey: vi.fn(() => "key"),
  readJsonSafe: vi.fn(async (file: string, fallback: unknown) =>
    structuredClone(store.get(file) ?? fallback)
  ),
  writeJsonAtomic: vi.fn(),
  logActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/storage-core", () => ({
  mutateJson: vi.fn(
    async (file: string, fallback: { items: unknown[] }, mutator: (d: { items: unknown[] }) => void) => {
      const current = structuredClone(store.get(file) ?? fallback) as { items: unknown[] };
      mutator(current);
      store.set(file, current);
      return current;
    }
  ),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(async () => ({ features: { dailyBrief: true } })),
}));

vi.mock("@/lib/focus", () => ({
  getFocusState: vi.fn(async () => ({ active: false })),
}));

vi.mock("@/lib/push-subscriptions", () => ({
  getSubscriptions: vi.fn(async () => []),
  removeSubscription: vi.fn(),
}));

vi.mock("@/lib/send-push", () => ({
  configureVapid: vi.fn(() => ({ publicKey: "", privateKey: "" })),
  getVapidDetails: vi.fn(() => ({ publicKey: "", privateKey: "" })),
  sendPushNotification: vi.fn(),
}));

vi.mock("@/lib/fcm", () => ({
  sendFcmToAll: vi.fn(
    async (payload: { title: string; tag?: string; dismiss?: boolean; progress?: number; progressMax?: number }) => {
      sent.push(payload);
      return { sent: true, devices: 1 };
    }
  ),
}));

const { checkReminders, dismissReminderCard } = await import("@/lib/notification-scheduler");

function card(overrides: Partial<FakeReminder> = {}): FakeReminder {
  return {
    id: "r1",
    title: "Appeler le plombier",
    notes: "Eau chaude HS",
    dueAt: new Date(at(14, 0)).toISOString(),
    status: "pending",
    ...overrides,
  };
}

describe("cartes de rappel", () => {
  beforeEach(() => {
    store.clear();
    sent.length = 0;
    state.reminders = [card()];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne poste rien plus d'une heure avant l'échéance", async () => {
    vi.setSystemTime(new Date(at(12, 59)));
    await checkReminders();
    expect(sent).toHaveLength(0);
  });

  it("poste 1 h avant, une seule fois, en carte promue", async () => {
    vi.setSystemTime(new Date(at(13, 0)));
    await checkReminders();
    vi.setSystemTime(new Date(at(13, 30)));
    await checkReminders();

    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe("Rappel dans 60 min : Appeler le plombier");
    expect(sent[0].tag).toBe("reminder-r1");
    expect(sent[0].progressMax).toBe(60);
    expect(sent[0].dismiss).toBe(false);
  });

  it("ferme la carte quand le rappel est fait", async () => {
    vi.setSystemTime(new Date(at(13, 0)));
    await checkReminders();

    await dismissReminderCard("r1");

    expect(sent.at(-1)).toMatchObject({ tag: "reminder-r1", dismiss: true });
    const tracked = store.get("live-notifs.json") as { items: { tag: string }[] };
    expect(tracked.items).toHaveLength(0);
  });

  it("ferme la carte d'un rappel qui n'est plus en attente", async () => {
    vi.setSystemTime(new Date(at(13, 0)));
    await checkReminders();

    state.reminders = [card({ status: "done" })];
    vi.setSystemTime(new Date(at(13, 5)));
    await checkReminders();

    expect(sent.at(-1)).toMatchObject({ tag: "reminder-r1", dismiss: true });
  });
});
