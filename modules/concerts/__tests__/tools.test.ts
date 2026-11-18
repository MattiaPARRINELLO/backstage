import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  getConcerts: vi.fn(),
  prepareConcert: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { listConcertsTool, prepareConcertTool } = await import("@/modules/concerts/tools");

const ctx = { moduleId: "concerts", log: () => {}, emit: () => {} };

describe("outils concerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("liste les concerts suivis", async () => {
    storage.getConcerts.mockResolvedValue({
      events: [{ artist: "Muse", venue: "Zenith", date: "2026-11-20", status: "upcoming" }],
    });
    const result = await listConcertsTool.run({}, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Muse @ Zenith");
  });

  it("rend un resultat vide sans concert", async () => {
    storage.getConcerts.mockResolvedValue({ events: [] });
    const result = await listConcertsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("prepare un concert", async () => {
    storage.prepareConcert.mockResolvedValue({
      weather: "12°C",
      venueInfo: "Zenith",
      checklist: ["Batteries"],
      travelTips: ["Partir tot"],
    });
    const result = await prepareConcertTool.run({ concertId: "c1" }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("12°C");
    expect(result.text).toContain("Zenith");
    expect(result.text).toContain("Batteries");
  });

  it("signale un concert introuvable", async () => {
    storage.prepareConcert.mockRejectedValue(new Error("Concert introuvable"));
    const result = await prepareConcertTool.run({ concertId: "absent" }, ctx);
    expect(result.status).toBe("error");
    expect(result.text).toContain("Concert introuvable");
  });

  it("exige un identifiant de concert", () => {
    expect(prepareConcertTool.params.safeParse({ concertId: " " }).success).toBe(false);
  });
});
