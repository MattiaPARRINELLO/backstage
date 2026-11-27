import { describe, it, expect, beforeEach, vi } from "vitest";

const mockConfig = {
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getModel: vi.fn(),
};

const mockSubs = {
  getSubscriptions: vi.fn(),
};

const mockModels = {
  fetchAvailableModels: vi.fn(),
};

vi.mock("@/lib/app-config", () => mockConfig);
vi.mock("@/lib/push-subscriptions", () => mockSubs);
vi.mock("@/lib/ai-providers/models", () => mockModels);
vi.mock("@/lib/session", () => ({ requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }) }));

const { loadRuntimeInfo, updateModels } = await import("@/app/actions/settings");

const baseConfig = {
  models: {
    general: "deepseek-v4.1-flash",
    generalAlt: "qwen3.8-max",
    code: "qwen4-max",
    titleModel: "deepseek-v4.1-flash",
  },
  llm: { temperature: 0.7, maxTokens: 4096 },
  features: { dailyBrief: true, webSearch: true },
  theme: { accentColor: "#a5b4fc" },
};

const available = [
  "deepseek-v4.1-flash",
  "glm-5.3",
  "qwen3.8-max",
  "qwen4-max",
];

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.getConfig.mockResolvedValue(baseConfig);
    mockConfig.getModel.mockImplementation(async (context: "general" | "code") =>
      context === "code"
        ? { primary: baseConfig.models.code, alt: baseConfig.models.code }
        : { primary: baseConfig.models.general, alt: baseConfig.models.generalAlt }
    );
    mockSubs.getSubscriptions.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    mockModels.fetchAvailableModels.mockResolvedValue(available);
  });

  describe("loadRuntimeInfo", () => {
    it("retourne les modèles configurés, la liste disponible et le nombre d'appareils push", async () => {
      const info = await loadRuntimeInfo();
      expect(info.models).toEqual({
        general: "deepseek-v4.1-flash",
        generalAlt: "qwen3.8-max",
        code: "qwen4-max",
      });
      expect(info.availableModels).toEqual(available);
      expect(info.pushCount).toBe(2);
      expect(info.features.dailyBrief).toBe(true);
    });
  });

  describe("updateModels", () => {
    it("sauvegarde les modèles choisis via updateConfig", async () => {
      mockConfig.updateConfig.mockResolvedValue(baseConfig);
      const result = await updateModels({
        general: "glm-5.3",
        generalAlt: "qwen3.8-max",
        code: "qwen4-max",
      });
      expect(mockConfig.updateConfig).toHaveBeenCalledWith({
        models: { general: "glm-5.3", generalAlt: "qwen3.8-max", code: "qwen4-max" },
      });
      expect(result).toEqual({
        general: "glm-5.3",
        generalAlt: "qwen3.8-max",
        code: "qwen4-max",
      });
    });

    it("rejette un modèle absent de la liste de l'API", async () => {
      await expect(
        updateModels({ general: "modele-inexistant", generalAlt: "qwen3.8-max", code: "qwen4-max" })
      ).rejects.toThrow("Modele indisponible : modele-inexistant");
      expect(mockConfig.updateConfig).not.toHaveBeenCalled();
    });

    it("rejette un champ vide après trim", async () => {
      await expect(
        updateModels({ general: "  ", generalAlt: "qwen3.8-max", code: "qwen4-max" })
      ).rejects.toThrow("Modele requis");
    });

    it("rejette un champ inattendu (schéma strict)", async () => {
      await expect(
        updateModels({ general: "modele-inexistant-2", generalAlt: "qwen3.8-max", code: "qwen4-max", extra: "x" } as never)
      ).rejects.toThrow(/extra/);
    });
  });
});
