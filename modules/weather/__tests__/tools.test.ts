import { beforeEach, describe, expect, it, vi } from "vitest";

const weather = { getWeather: vi.fn() };

vi.mock("@/lib/weather", () => weather);

const { getWeatherTool } = await import("@/modules/weather/tools");

const ctx = { moduleId: "weather", log: () => {}, emit: () => {} };

describe("outil meteo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rend la meteo quand la source repond", async () => {
    weather.getWeather.mockResolvedValue("**Paris** : 12°C");
    const result = await getWeatherTool.run({ city: "Paris" }, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Paris");
    expect(weather.getWeather).toHaveBeenCalledWith("Paris");
  });

  it("signale une cle absente comme une erreur", async () => {
    weather.getWeather.mockResolvedValue("Erreur : clé API météo non configurée.");
    const result = await getWeatherTool.run({ city: "Paris" }, ctx);
    expect(result.status).toBe("error");
  });

  it("signale une ville inconnue comme une erreur", async () => {
    weather.getWeather.mockResolvedValue('Ville "Nowhere" introuvable.');
    const result = await getWeatherTool.run({ city: "Nowhere" }, ctx);
    expect(result.status).toBe("error");
  });

  it("exige une ville non vide", () => {
    const parsed = getWeatherTool.params.safeParse({ city: "  " });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe("Ville requise");
  });
});
