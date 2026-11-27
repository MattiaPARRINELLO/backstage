import path from "path";
import { readJsonSafe } from "./storage-core";
import { mutateJson } from "./storage-core";
import { fetchAvailableModels, peekAvailableModels, warmModelCatalog } from "./ai-providers/models";

/** Catalogue des modules distribues depuis `mprnl/BS-modules` (issue #271). */
export const DEFAULT_MODULE_CATALOG_URL =
  "https://raw.githubusercontent.com/mprnl/BS-modules/main/catalog.json";

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
  modules: {
    /** Source du catalogue, surchargeable pour les tests ou un miroir. */
    catalogUrl: string;
  };
}

const CONFIG_FILENAME = "config.json";
const CONFIG_PATH = path.join(process.cwd(), "data", CONFIG_FILENAME);

const defaultConfig: AppConfig = {
  models: {
    general: "deepseek-v4.1-flash",
    generalAlt: "qwen3.8-max",
    code: "qwen4-max",
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
  modules: {
    catalogUrl: DEFAULT_MODULE_CATALOG_URL,
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
    modules: { ...defaultConfig.modules, ...parsed.modules },
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
type ModelField = keyof AppConfig["models"];

// Identifiants confirmes morts en production, meme quand `GET /models` les
// liste encore (cache provider en retard, ou modele global non servi a ce
// compte). Une liste de noms ici n'est pas une source de verite : le catalogue
// reste la reference, cette liste ne fait qu'ecarter des morts connus.
const RETIRED_MODELS = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "kimi-k2.7-code",
]);

function usableModels(available: readonly string[]): string[] {
  const usable = available.filter((model) => !RETIRED_MODELS.has(model));
  return usable.length > 0 ? usable : [...available];
}

function replacementModel(
  available: readonly string[],
  context: "general" | "code",
  preferred: string,
  avoid?: string
): string {
  if (context === "code") {
    // Aucun modele ne porte plus « code » dans son identifiant : on prend le
    // plus capable disponible, sinon le premier de la liste.
    return (
      available.find((m) => m.includes("code")) ??
      available.find((m) => m.includes("max")) ??
      available[0] ??
      preferred
    );
  }
  // Le modele de secours doit differer du principal, sinon il ne sert a rien.
  return (
    available.find((m) => m !== preferred && m !== avoid) ??
    available[0] ??
    preferred
  );
}

async function persistReplacement(field: ModelField, replacement: string): Promise<void> {
  try {
    const models: Partial<AppConfig["models"]> = {};
    models[field] = replacement;
    await updateConfig({ models });
  } catch (err) {
    // Un disque en lecture seule ne doit pas empecher de repondre : le repli
    // vaut pour ce tour, il sera recalcule au suivant.
    console.warn(`[config] Modele de repli ${replacement} non persiste`, err);
  }
}

async function resolveAvailableModel(
  field: ModelField,
  preferred: string,
  context: "general" | "code",
  avoid?: string
): Promise<string> {
  const available = peekAvailableModels();
  if (!available) {
    warmModelCatalog();
    return preferred;
  }
  const usable = usableModels(available);
  if (usable.includes(preferred)) return preferred;

  const replacement = replacementModel(usable, context, preferred, avoid);
  if (replacement !== preferred) {
    console.warn(
      `[config] Modele indisponible chez le provider (${preferred}), repli sur ${replacement}`
    );
    await persistReplacement(field, replacement);
  }
  return replacement;
}

export async function getModel(context: "general" | "code"): Promise<{ primary: string; alt: string }> {
  const config = await getConfig();
  if (context === "code") {
    const model = await resolveAvailableModel("code", config.models.code, "code");
    return { primary: model, alt: model };
  }
  const primary = await resolveAvailableModel(
    "general",
    config.models.general,
    "general"
  );
  const alt = await resolveAvailableModel(
    "generalAlt",
    config.models.generalAlt,
    "general",
    primary
  );
  return { primary, alt };
}

// Modele economique des taches internes (titres de conversation, resumes).
export async function getTitleModel(): Promise<string> {
  const config = await getConfig();
  return resolveAvailableModel("titleModel", config.models.titleModel, "general");
}

/**
 * Repare une configuration dont un ou plusieurs modeles ont disparu du
 * catalogue du provider. Appelee au demarrage, hors du chemin d'une requete :
 * un deploiement qui repart des defauts perimes se repare seul au lieu
 * d'obliger a repasser par les reglages.
 *
 * Le repli sur `FALLBACK_CATALOG` n'est jamais cache : si le provider est
 * injoignable, `peekAvailableModels()` reste vide et on ne touche pas a la
 * configuration, pour ne pas remplacer un modele valide par un repli devine.
 */
export async function healConfiguredModels(): Promise<void> {
  await fetchAvailableModels();
  const available = peekAvailableModels();
  if (!available) return;

  const config = await getConfig();
  const usable = usableModels(available);
  const updates: Partial<AppConfig["models"]> = {};
  const fields: ModelField[] = ["general", "generalAlt", "code", "titleModel"];
  for (const field of fields) {
    const current = config.models[field];
    if (usable.includes(current)) continue;
    const context = field === "code" ? "code" : "general";
    updates[field] = replacementModel(usable, context, current, updates.general);
  }
  if (Object.keys(updates).length === 0) return;

  console.warn(
    `[config] Modeles indisponibles remplaces au demarrage : ${JSON.stringify(updates)}`
  );
  await updateConfig({ models: updates });
}
