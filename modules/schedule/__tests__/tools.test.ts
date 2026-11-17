import { beforeEach, describe, expect, it, vi } from "vitest";

const schedule = {
  getCourses: vi.fn(),
  formatCourse: vi.fn((course: { subject: string; room: string }) => `${course.subject} — ${course.room}`),
  getCoursesForDay: vi.fn(),
  getNextCourse: vi.fn(),
  getUpcomingCourses: vi.fn(),
};

vi.mock("@/lib/storage/schedule", () => schedule);

const { getScheduleTool } = await import("@/modules/schedule/tools");

const ctx = { moduleId: "schedule", log: () => {}, emit: () => {} };

const course = { uuid: "u1", subject: "Analyse", room: "Amphi B", start: "2026-10-01T10:00:00.000Z" };

describe("outil emploi du temps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signale un emploi du temps jamais synchronise", async () => {
    schedule.getCourses.mockResolvedValue([]);
    const result = await getScheduleTool.run({ scope: "next" }, ctx);
    expect(result.status).toBe("error");
    expect(result.text).toContain("Emploi du temps inconnu");
  });

  it("rend un statut vide, pas un succes, quand il n'y a aucun cours", async () => {
    schedule.getCourses.mockResolvedValue([course]);
    schedule.getNextCourse.mockReturnValue(null);

    const result = await getScheduleTool.run({ scope: "next" }, ctx);

    expect(result.status).toBe("empty");
    expect(result.text).toContain("Aucun cours");
  });

  it("rend le prochain cours avec sa salle", async () => {
    schedule.getCourses.mockResolvedValue([course]);
    schedule.getNextCourse.mockReturnValue(course);

    const result = await getScheduleTool.run({ scope: "next", subject: "analyse" }, ctx);

    expect(result.status).toBe("ok");
    expect(result.text).toContain("Analyse — Amphi B");
    expect(schedule.getNextCourse).toHaveBeenCalledWith(expect.anything(), "analyse");
  });
});
