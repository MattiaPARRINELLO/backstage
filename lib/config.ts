import path from "path";
import { readJsonSafe } from "./storage";
import { mutateJson } from "./storage-core";
import { peekAvailableModels, warmModelCatalog } from "./ai-providers/models";

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
  };
  theme: {
    accentColor: string;
  };
}

const CONFIG_FILENAME = "config.json";
const CONFIG_PATH = path.join(process.cwd(), "data", CONFIG_FILENAME);

const defaultConfig: AppConfig = {
  models: {
    general: "deepseek-v4.1-flash",
    generalAlt: "deepseek-v4-pro",
    code: "kimi-k2.7-code",
    titleModel: "deepseek-v4.1-flash",
  },
  llm: {
    temperature: 0.7,
    maxTokens: 4096,
  },
  features: {
    dailyBrief: true,
    webSearch: true,
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
    theme: { ...defaultConfig.theme, ...parsed.theme },
  };
  cachedConfig = { data: merged, ts: Date.now() };
  return merged;
}

export type ConfigUpdate = {
  models?: Partial<AppConfig["models"]>;
  llm?: Partial<AppConfig["llm"]>;
  features?: Partial<AppConfig["features"]>;
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

// Les identifiants de modeles du provider bougent (retrait, renommage) :
// un modele configure qui n'existe plus doit etre remplace automatiquement
// plutot que de faire echouer chaque appel IA (400 « Model is unavailable »).
// On ne consulte que le catalogue deja en cache : jamais d'appel reseau sur
// le chemin d'un tour de chat. Cache froid -> on garde le modele configure et
// on rafraichit en arriere-plan pour le tour suivant.
async function resolveAvailableModel(
  preferred: string,
  context: "general" | "code"
): Promise<string> {
  const available = peekAvailableModels();
  if (!available) {
    warmModelCatalog();
    return preferred;
  }
  if (available.includes(preferred)) return preferred;

  const replacement =
    (context === "code" ? available.find((m) => m.includes("code")) : undefined) ??
    available[0] ??
    preferred;
  if (replacement !== preferred) {
    console.warn(
      `[config] Modele indisponible chez le provider (${preferred}), repli sur ${replacement}`
    );
  }
  return replacement;
}

export async function getModel(context: "general" | "code"): Promise<{ primary: string; alt: string }> {
  const config = await getConfig();
  if (context === "code") {
    const model = await resolveAvailableModel(config.models.code, "code");
    return { primary: model, alt: model };
  }
  const [primary, alt] = await Promise.all([
    resolveAvailableModel(config.models.general, "general"),
    resolveAvailableModel(config.models.generalAlt, "general"),
  ]);
  return { primary, alt };
}

// Modele economique des taches internes (titres de conversation, resumes).
export async function getTitleModel(): Promise<string> {
  const config = await getConfig();
  return resolveAvailableModel(config.models.titleModel, "general");
}
