import { beforeEach, describe, expect, it, vi } from "vitest";

// Le cron cPanel et le scheduler interne declenchent le brief a la meme
// minute. La garde « deja envoye » ne couvrait que le push : les deux appels
// generaient un brief, donc deux factures provider pour la meme journee.
const today = new Date().toISOString().slice(0, 10);

const state = {
  briefs: [] as Record<string, unknown>[],
  notified: { briefs: [] as { date: string; at: string }[] },
  generations: 0,
  notifications: 0,
};

vi.mock("@/lib/storage", () => ({
  readJsonSafe: vi.fn(async (file: string) => {
    if (file === "daily-briefs.json") return { briefs: state.briefs };
    if (file === "notified-briefs.json") return state.notified;
    return {};
  }),
  writeJsonAtomic: vi.fn(async (file: string, data: unknown) => {
    if (file === "daily-briefs.json") state.briefs = (data as { briefs: [] }).briefs;
  }),
  logActivity: vi.fn(),
  getReminders: vi.fn(async () => ({ reminders: [] })),
  getCourses: vi.fn(async () => []),
  getCoursesStartingSoon: vi.fn(() => []),
  courseNotifKey: vi.fn(() => "key"),
}));

vi.mock("@/lib/storage-core", () => ({
  mutateJson: vi.fn(async (file: string, _fallback: unknown, mutator: (d: unknown) => unknown) => {
    if (file === "notified-briefs.json") {
      const data = { briefs: [...state.notified.briefs] };
      mutator(data);
      state.notified = data;
      return data;
    }
    return {};
  }),
}));

vi.mock("@/lib/daily-brief", () => ({
  generateDailyBrief: vi.fn(async () => {
    state.generations += 1;
    state.briefs.unshift({
      date: today,
      summary: "Brief genere",
      events: [],
      reminders: [],
      emails: [],
      generatedAt: new Date().toISOString(),
    });
    return "Brief genere";
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
  state.briefs = [];
  state.notified = { briefs: [] };
  state.generations = 0;
  state.notifications = 0;
  vi.clearAllMocks();
});

describe("triggerDailyBrief — une seule generation par jour", () => {
  it("deux declenchements simultanes ne generent qu'un brief", async () => {
    await Promise.all([triggerDailyBrief("cron"), triggerDailyBrief("interne")]);

    expect(state.generations).toBe(1);
    expect(state.briefs).toHaveLength(1);
  });

  it("ne regenere pas quand le brief du jour existe deja", async () => {
    state.briefs = [
      { date: today, summary: "Deja la", events: [], reminders: [], emails: [], generatedAt: "" },
    ];

    const result = await triggerDailyBrief("cron");

    expect(state.generations).toBe(0);
    expect(result).toMatchObject({ sent: true });
  });
});
