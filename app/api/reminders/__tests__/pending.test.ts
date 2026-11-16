import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Reminder } from "@/lib/types";

const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

const mockGetReminders = vi.fn();
vi.mock("@/lib/storage", () => ({ getReminders: mockGetReminders }));

const { GET } = await import("@/app/api/reminders/pending/route");

const NOW = new Date("2026-01-01T12:00:00.000Z");

function reminder(overrides: Partial<Reminder> & { id: string; dueAt: string }): Reminder {
  return {
    title: `Rappel ${overrides.id}`,
    status: "pending",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockGetSession.mockResolvedValue(null);
  mockGetReminders.mockResolvedValue({ reminders: [] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/reminders/pending", () => {
  it("repond 200 avec une liste vide et sw-cached-at sans session", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reminders: [] });
    expect(res.headers.get("sw-cached-at")).toBe(NOW.toISOString());
  });

  it("ne renvoie jamais 401 sans cookie de session", async () => {
    const res = await GET();

    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
    expect(mockGetReminders).not.toHaveBeenCalled();
  });

  it("ne renvoie que les rappels pending dus dans moins de 60 s ou deja passes", async () => {
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockGetReminders.mockResolvedValue({
      reminders: [
        reminder({ id: "du-maintenant", dueAt: NOW.toISOString() }),
        reminder({ id: "dans-30s", dueAt: "2026-01-01T12:00:30.000Z" }),
        reminder({ id: "dans-2h", dueAt: "2026-01-01T14:00:00.000Z" }),
        reminder({ id: "deja-fait", dueAt: "2026-01-01T11:00:00.000Z", status: "done" }),
        reminder({ id: "en-retard", dueAt: "2026-01-01T11:30:00.000Z" }),
      ],
    });

    const res = await GET();
    const body = (await res.json()) as { reminders: Reminder[] };

    expect(res.status).toBe(200);
    expect(body.reminders.map((r) => r.id)).toEqual(["du-maintenant", "dans-30s", "en-retard"]);
    expect(res.headers.get("sw-cached-at")).toBe(NOW.toISOString());
  });

  it("exclut un rappel a exactement 60 s plus une milliseconde", async () => {
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockGetReminders.mockResolvedValue({
      reminders: [reminder({ id: "trop-tard", dueAt: "2026-01-01T12:01:00.001Z" })],
    });

    const body = (await (await GET()).json()) as { reminders: Reminder[] };

    expect(body.reminders).toEqual([]);
  });

  it("ne logge ni contenu de rappel ni token", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockGetReminders.mockResolvedValue({
      reminders: [reminder({ id: "secret-1", dueAt: NOW.toISOString() })],
    });

    await GET();

    for (const spy of [log, info, warn, error, debug]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
