import { beforeEach, describe, expect, it, vi } from "vitest";

// Le scheduler porte la garde anti-doublon du brief : le cron cPanel et le
// scheduler interne peuvent tomber sur la meme minute, et sans elle chaque
// appel renvoyait un push (constate en production).
const state = {
  notified: { briefs: [] as { date: string; at: string }[] },
  marks: [] as string[],
  notifications: 0,
};

const today = new Date().toISOString().slice(0, 10);

const brief = {
  date: today,
  summary: "## Journée\n- premier point",
  events: [],
  reminders: [],
  emails: [],
  generatedAt: new Date().toISOString(),
};

vi.mock("@/lib/storage", () => ({
  readJsonSafe: vi.fn(async (file: string) => {
    if (file === "daily-briefs.json") return { briefs: [brief] };
    if (file === "notified-briefs.json") return state.notified;
    return {};
  }),
  writeJsonAtomic: vi.fn(),
  logActivity: vi.fn(),
  getReminders: vi.fn(async () => ({ reminders: [] })),
  getCourses: vi.fn(async () => []),
  getCoursesStartingSoon: vi.fn(() => []),
  courseNotifKey: vi.fn(() => "key"),
}));

vi.mock("@/lib/storage-core", () => ({
  mutateJson: vi.fn(async (file: string, _fallback: unknown, mutator: (d: unknown) => unknown) => {
    const data = { briefs: [...state.notified.briefs] };
    mutator(data);
    if (file === "notified-briefs.json" && data.briefs.length > state.notified.briefs.length) {
      state.marks.push(today);
    }
    return data;
  }),
}));

vi.mock("@/lib/push-subscriptions", () => ({
  getSubscriptions: vi.fn(async () => [
    { endpoint: "https://push.example/1", keys: { p256dh: "x", auth: "y" } },
  ]),
  removeSubscription: vi.fn(),
}));

vi.mock("@/lib/send-push", () => ({
  configureVapid: vi.fn(() => ({
    subject: "mailto:backstage@localhost",
    publicKey: "pub",
    privateKey: "priv",
  })),
  getVapidDetails: vi.fn(() => ({
    subject: "mailto:backstage@localhost",
    publicKey: "pub",
    privateKey: "priv",
  })),
  sendPushNotification: vi.fn(async () => {
    state.notifications += 1;
  }),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(async () => ({ features: { dailyBrief: true } })),
}));

const { triggerDailyBrief } = await import("@/lib/notification-scheduler");

beforeEach(() => {
  state.notified = { briefs: [] };
  state.marks = [];
  state.notifications = 0;
  vi.clearAllMocks();
});

describe("triggerDailyBrief — un seul envoi par jour", () => {
  it("envoie puis marque le brief du jour", async () => {
    const result = await triggerDailyBrief("cron");

    expect(result).toMatchObject({ sent: true });
    expect(state.notifications).toBe(1);
    expect(state.marks).toEqual([today]);
  });

  it("ignore un second appel le même jour", async () => {
    state.notified = { briefs: [{ date: today, at: new Date().toISOString() }] };

    const result = await triggerDailyBrief("cron");

    expect(result).toEqual({ skipped: "brief deja envoye aujourd'hui" });
    expect(state.notifications).toBe(0);
  });

  it("laisse la source page-test renvoyer volontairement le brief", async () => {
    state.notified = { briefs: [{ date: today, at: new Date().toISOString() }] };

    const result = await triggerDailyBrief("page-test");

    expect(result).toMatchObject({ sent: true });
    expect(state.notifications).toBe(1);
  });

  it("ne marque rien si aucun envoi n'a abouti", async () => {
    const { sendPushNotification } = await import("@/lib/send-push");
    vi.mocked(sendPushNotification).mockRejectedValueOnce(new Error("panne"));

    const result = await triggerDailyBrief("cron");

    expect(result).toMatchObject({ sent: false });
    expect(state.marks).toEqual([]);
  });
});
