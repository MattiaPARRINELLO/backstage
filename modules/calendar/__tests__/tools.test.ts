import { beforeEach, describe, expect, it, vi } from "vitest";

const google = {
  createGoogleCalendarEvent: vi.fn(),
  updateGoogleCalendarEvent: vi.fn(),
  deleteGoogleCalendarEvent: vi.fn(),
  fetchGoogleCalendarEvents: vi.fn(),
};

vi.mock("@/lib/google-actions", () => google);

const {
  createCalendarEventTool,
  deleteCalendarEventTool,
  searchCalendarEventsTool,
  updateCalendarEventTool,
} = await import("@/modules/calendar/tools");

const ctx = { moduleId: "calendar", log: () => {}, emit: () => {} };

describe("outils calendrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cree un evenement et rend son identifiant", async () => {
    google.createGoogleCalendarEvent.mockResolvedValue("evt-1");
    const result = await createCalendarEventTool.run(
      { title: "Rendez-vous", start_time: "2026-11-20T10:00:00Z", end_time: "2026-11-20T11:00:00Z" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("evt-1");
    expect(google.createGoogleCalendarEvent).toHaveBeenCalled();
  });

  it("met a jour un evenement", async () => {
    google.updateGoogleCalendarEvent.mockResolvedValue(undefined);
    const result = await updateCalendarEventTool.run(
      { event_id: "evt-1", title: "Nouveau" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(google.updateGoogleCalendarEvent).toHaveBeenCalledWith("evt-1", {
      summary: "Nouveau",
      description: undefined,
      location: undefined,
      colorId: undefined,
    });
  });

  it("supprime un evenement", async () => {
    google.deleteGoogleCalendarEvent.mockResolvedValue(undefined);
    const result = await deleteCalendarEventTool.run({ event_id: "evt-1" }, ctx);
    expect(result.status).toBe("ok");
    expect(google.deleteGoogleCalendarEvent).toHaveBeenCalledWith("evt-1");
  });

  it("liste les evenements a venir", async () => {
    google.fetchGoogleCalendarEvents.mockResolvedValue([
      { summary: "Concert", start: "2026-11-21T20:00:00Z", location: "Zenith" },
    ]);
    const result = await searchCalendarEventsTool.run({ days: 7 }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Concert");
    expect(result.text).toContain("Zenith");
  });

  it("rend un resultat vide sans evenement", async () => {
    google.fetchGoogleCalendarEvents.mockResolvedValue([]);
    const result = await searchCalendarEventsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("exige titre et bornes pour creer", () => {
    expect(createCalendarEventTool.params.safeParse({ title: "x" }).success).toBe(false);
  });
});
