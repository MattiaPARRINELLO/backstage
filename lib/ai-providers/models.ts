import { getClientConfig, AVAILABLE_MODELS, isAnthropicModel } from "./config";
import { getServerCached, setServerCached } from "@/lib/server-cache";

const CACHE_KEY = "available-models-v2";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const FETCH_TIMEOUT_MS = 10_000;

// Protocole attendu par l'endpoint IA pour un modele donne. Le provider le
// declare lui-meme dans `GET /models` (cle `api`) : c'est la source de verite,
// pas une liste ecrite a la main qui se perime a chaque nouvelle sortie.
export type ModelProtocol = "openai" | "anthropic" | "responses" | "gemini";

export type ModelInfo = { id: string; protocol: ModelProtocol };

function protocolFromApi(api: unknown): ModelProtocol {
  const keys = api && typeof api === "object" ? Object.keys(api as object) : [];
  if (keys.includes("messages")) return "anthropic";
  if (keys.includes("responses")) return "responses";
  if (keys.includes("generate-content")) return "gemini";
  return "openai";
}

// Repli statique : uniquement des modeles verifies vivants chez le provider.
// Il ne sert qu'en cas d'echec reseau (et `isAnthropicModel` en cas de cache
// froid), jamais a masquer une liste perimee.
const FALLBACK_CATALOG: ModelInfo[] = AVAILABLE_MODELS.map((id) => ({
  id,
  protocol: isAnthropicModel(id) ? "anthropic" : "openai",
}));

// Catalogue des modeles proposes par l'endpoint IA (GET {baseURL}/models),
// avec cache memoire+disque d'une heure. En cas d'echec reseau ou de liste
// vide, repli sur la liste connue pour ne jamais bloquer l'interface.
export async function fetchModelCatalog(): Promise<ModelInfo[]> {
  const cached = getServerCached<ModelInfo[]>(CACHE_KEY);
  if (cached && cached.length > 0) return cached;

  try {
    const { baseURL, apiKey } = getClientConfig();
    const res = await fetch(`${baseURL.replace(/\/+$/, "")}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "personalbrain/1.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`status=${res.status}`);
    const body = (await res.json()) as {
      data?: { id?: string; model?: string; api?: unknown }[];
    };
    const catalog = (body.data ?? [])
      .map((m) => {
        const id = m.id ?? m.model ?? "";
        return id ? { id, protocol: protocolFromApi(m.api) } : null;
      })
      .filter((m): m is ModelInfo => m !== null);
    if (catalog.length === 0) throw new Error("liste vide");
    setServerCached(CACHE_KEY, catalog, CACHE_TTL_MS);
    return catalog;
  } catch (err) {
    console.warn("[ai-models] Recuperation des modeles echouee, repli sur la liste connue:", err);
    return [...FALLBACK_CATALOG];
  }
}

// Identifiants seuls (interface Parametres -> Modeles d'IA).
export async function fetchAvailableModels(): Promise<string[]> {
  return (await fetchModelCatalog()).map((m) => m.id);
}

// Catalogue deja en cache, sans appel reseau. `null` = cache froid.
export function peekAvailableModels(): string[] | null {
  const cached = getServerCached<ModelInfo[]>(CACHE_KEY);
  if (!cached || cached.length === 0) return null;
  return cached.map((m) => m.id);
}

// Rafraichit le catalogue en arriere-plan sans bloquer l'appelant : le tour
// en cours garde le modele configure, le suivant beneficie de la liste a jour.
export function warmModelCatalog(): void {
  if (peekAvailableModels()) return;
  void fetchModelCatalog();
}

// Protocole d'un modele, en synchrone (le routage SDK ne peut pas attendre un
// appel reseau). Lit le catalogue en cache ; s'il est froid, retombe sur la
// liste statique des modeles Anthropic connus.
export function getModelProtocol(model: string): ModelProtocol {
  const cached = getServerCached<ModelInfo[]>(CACHE_KEY);
  const found = cached?.find((m) => m.id === model);
  if (found) return found.protocol;
  return isAnthropicModel(model) ? "anthropic" : "openai";
}
