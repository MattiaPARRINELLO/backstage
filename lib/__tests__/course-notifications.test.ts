import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Le planning des cartes de cours est une règle métier précise : affichée
// 30 min avant la séance, fermée dès que le cours commence, une seule fois par
// cours. Un bug ici se voit en production (carte fantôme toute la journée ou
// notification absente), d'où ce test avec horloge simulée.
const store = new Map<string, unknown>();
const sent: { title: string; tag?: string; dismiss?: boolean; body?: string }[] = [];

const COURSES = [
  { uuid: "c1", subject: "E17 PYTHON", room: "Salle 06", teacher: "M. Martin", start: 0, end: 0 },
];

function at(hour: number, minute = 0): number {
  const d = new Date(2026, 10, 4, hour, minute, 0, 0);
  return d.getTime();
}

vi.mock("@/lib/storage", () => ({
  getCourses: vi.fn(async () => COURSES),
  getCoursesStartingSoon: vi.fn((courses: typeof COURSES, leadMin: number, nowMs: number) =>
    courses.filter((c) => c.start > nowMs && c.start <= nowMs + leadMin * 60_000)
  ),
  courseNotifKey: vi.fn((c: { uuid: string }, lead: number) => `${c.uuid}@${lead}min`),
  getReminders: vi.fn(async () => ({ reminders: [] })),
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
  sendFcmToAll: vi.fn(async (payload: { title: string; tag?: string; dismiss?: boolean }) => {
    sent.push(payload);
    return { sent: true, devices: 1 };
  }),
}));

const { checkScheduleNotifs } = await import("@/lib/notification-scheduler");

describe("cartes de cours", () => {
  beforeEach(() => {
    store.clear();
    sent.length = 0;
    vi.useFakeTimers();
    COURSES[0].start = at(9, 0);
    COURSES[0].end = at(12, 0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ne poste rien plus de 30 min avant", async () => {
    vi.setSystemTime(new Date(at(8, 29)));
    await checkScheduleNotifs();
    expect(sent).toHaveLength(0);
  });

  it("poste à −30 min, une seule fois", async () => {
    vi.setSystemTime(new Date(at(8, 30)));
    await checkScheduleNotifs();
    await checkScheduleNotifs();
    vi.setSystemTime(new Date(at(8, 45)));
    await checkScheduleNotifs();

    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe("Cours dans 30 min : E17 PYTHON");
    expect(sent[0].tag).toBe("course-c1@30min");
    expect(sent[0].dismiss).toBe(false);
  });

  it("ferme la carte dès que le cours commence", async () => {
    vi.setSystemTime(new Date(at(8, 30)));
    await checkScheduleNotifs();
    expect(sent).toHaveLength(1);

    vi.setSystemTime(new Date(at(8, 59)));
    await checkScheduleNotifs();
    expect(sent).toHaveLength(1); // toujours affichée

    vi.setSystemTime(new Date(at(9, 0)));
    await checkScheduleNotifs();
    expect(sent).toHaveLength(2);
    expect(sent[1].dismiss).toBe(true);
    expect(sent[1].tag).toBe("course-c1@30min");

    // et elle n'est pas re-postée ensuite
    vi.setSystemTime(new Date(at(9, 5)));
    await checkScheduleNotifs();
    expect(sent).toHaveLength(2);
  });

  it("chaque cours a sa propre carte", async () => {
    const second = { ...COURSES[0], uuid: "c2", start: at(13, 30), end: at(16, 30) };
    COURSES.push(second);

    vi.setSystemTime(new Date(at(8, 30)));
    await checkScheduleNotifs();
    vi.setSystemTime(new Date(at(13, 0)));
    await checkScheduleNotifs();

    expect(sent.filter((s) => !s.dismiss).map((s) => s.tag)).toEqual([
      "course-c1@30min",
      "course-c2@30min",
    ]);
    COURSES.pop();
  });
});
