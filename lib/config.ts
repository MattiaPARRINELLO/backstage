import path from "path";
import { readJsonSafe } from "./storage";
import { mutateJson } from "./storage-core";

export interface AppConfig {
  models: {
    general: string;
    generalAlt: string;
    code: string;
    titleModel: string;
  };
  llm: {
    temperature: number;
    maxTokens: number;
  };
  features: {
    dailyBrief: boolean;
    webSearch: boolean;
    /** Notifications Discord (cours, rappels, relances, brief du jour). */
    discordNotifications: boolean;
  };
  discord: {
    /** Destinataire des DM — l'ID utilisateur peut venir de /settings. */
    userId: string;
    /** Alertes techniques issues de serverLog. */
    alerts: boolean;
  };
  theme: {
    accentColor: string;
  };
}

const CONFIG_FILENAME = "config.json";
const CONFIG_PATH = path.join(process.cwd(), "data", CONFIG_FILENAME);

const defaultConfig: AppConfig = {
  models: {
    general: "kimi-k2.6",
    generalAlt: "deepseek-v4-flash",
    code: "kimi-k2.7-code",
    titleModel: "deepseek-v4-flash",
  },
  llm: {
    temperature: 0.7,
    maxTokens: 4096,
  },
  features: {
    dailyBrief: true,
    webSearch: true,
    discordNotifications: true,
  },
  discord: {
    userId: "",
    alerts: true,
  },
  theme: {
    accentColor: "#a5b4fc",
  },
};

const CACHE_TTL = 60_000;

let cachedConfig: { data: AppConfig; ts: number } | null = null;

function invalidateCache() {
  cachedConfig = null;
}

export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig && Date.now() - cachedConfig.ts < CACHE_TTL) {
    return cachedConfig.data;
  }

  const parsed = await readJsonSafe<Partial<AppConfig>>(CONFIG_FILENAME, defaultConfig);
  const merged: AppConfig = {
    ...defaultConfig,
    ...parsed,
    models: { ...defaultConfig.models, ...parsed.models },
    llm: { ...defaultConfig.llm, ...parsed.llm },
    features: { ...defaultConfig.features, ...parsed.features },
    discord: { ...defaultConfig.discord, ...parsed.discord },
    theme: { ...defaultConfig.theme, ...parsed.theme },
  };
  cachedConfig = { data: merged, ts: Date.now() };
  return merged;
}

export type ConfigUpdate = {
  models?: Partial<AppConfig["models"]>;
  llm?: Partial<AppConfig["llm"]>;
  features?: Partial<AppConfig["features"]>;
  discord?: Partial<AppConfig["discord"]>;
  theme?: Partial<AppConfig["theme"]>;
};

export async function updateConfig(partial: ConfigUpdate): Promise<AppConfig> {
  // mutateJson : lecture et écriture sous un seul lock (deux mises à jour
  // simultanées ne se perdent plus mutuellement).
  const next = (await mutateJson<AppConfig>(CONFIG_FILENAME, defaultConfig, (current) => {
    return {
      ...current,
      ...partial,
      models: { ...defaultConfig.models, ...current.models, ...partial.models },
      llm: { ...defaultConfig.llm, ...current.llm, ...partial.llm },
      features: { ...defaultConfig.features, ...current.features, ...partial.features },
      discord: { ...defaultConfig.discord, ...current.discord, ...partial.discord },
      theme: { ...defaultConfig.theme, ...current.theme, ...partial.theme },
    };
  })) ?? defaultConfig;
  cachedConfig = { data: next, ts: Date.now() };
  return next;
}

export function getConfigCachePath(): string {
  return CONFIG_PATH;
}

export function clearConfigCache() {
  invalidateCache();
}

export async function getModel(context: "general" | "code"): Promise<{ primary: string; alt: string }> {
  const config = await getConfig();
  if (context === "code") {
    return { primary: config.models.code, alt: config.models.code };
  }
  return { primary: config.models.general, alt: config.models.generalAlt };
}
