import { beforeEach, describe, expect, it, vi } from "vitest";

const primary = "deepseek-v4.1-flash";
const alt = "qwen3.8-max";

const chatCompletion = vi.fn();
const getModel = vi.fn();

vi.mock("@/lib/ai-providers", () => ({ chatCompletion }));
vi.mock("@/lib/app-config", () => ({
  getConfig: vi.fn(async () => ({ features: { dailyBrief: true } })),
  getModel,
}));
vi.mock("@/lib/google-actions", () => ({
  fetchGoogleCalendarEvents: vi.fn(async () => []),
  fetchGmailMessages: vi.fn(async () => []),
}));
vi.mock("@/lib/storage", () => ({
  getReminders: vi.fn(async () => ({ reminders: [] })),
  getConcerts: vi.fn(async () => ({ events: [] })),
  getLeetcode: vi.fn(async () => ({ exercises: [] })),
  getCalendar: vi.fn(async () => []),
  getCourses: vi.fn(async () => []),
  getCoursesForDay: vi.fn(() => []),
  prepareConcert: vi.fn(),
  formatCourse: vi.fn(() => ""),
  readJsonSafe: vi.fn(async () => ({ briefs: [] })),
  writeJsonAtomic: vi.fn(async () => {}),
}));
vi.mock("@/lib/utils", () => ({
  toISODate: (value: string) => String(value).slice(0, 10),
  toHHMM: () => "",
}));
vi.mock("@/lib/weather", () => ({
  getWeatherSummary: vi.fn(async () => ""),
}));

const { generateDailyBrief } = await import("@/lib/daily-brief");

// Regression : le brief du matin ne basculait pas sur le modele de secours.
// Un principal en panne faisait disparaitre la notification un matin sur deux.
describe("generateDailyBrief — repli de modele", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getModel.mockResolvedValue({ primary, alt });
  });

  it("bascule sur le modele de secours quand le principal echoue", async () => {
    chatCompletion
      .mockRejectedValueOnce(new Error("400 Model is unavailable"))
      .mockResolvedValueOnce({ content: "Brief de secours" });

    const summary = await generateDailyBrief();

    expect(summary).toBe("Brief de secours");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
    expect(chatCompletion.mock.calls[0]?.[0]).toBe(primary);
    expect(chatCompletion.mock.calls[1]?.[0]).toBe(alt);
  });

  it("ne rejoue pas le meme modele quand le secours est identique", async () => {
    getModel.mockResolvedValue({ primary, alt: primary });
    chatCompletion.mockRejectedValue(new Error("panne"));

    const summary = await generateDailyBrief();

    expect(summary).toBeNull();
    expect(chatCompletion).toHaveBeenCalledTimes(1);
  });

  it("garde le modele principal quand il repond", async () => {
    chatCompletion.mockResolvedValue({ content: "Brief normal" });

    const summary = await generateDailyBrief();

    expect(summary).toBe("Brief normal");
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    expect(chatCompletion.mock.calls[0]?.[0]).toBe(primary);
  });
});
