import { getConfig } from "@/lib/config";

// Mode de developpement sans cle API : `AI_PROVIDER=mock` remplace tous les
// appels au provider par des reponses scriptees (lib/ai-providers/mock.ts).
// Toute autre valeur (ou l'absence de valeur) garde le provider reel.
export function isMockAiEnabled(): boolean {
  return getConfig().AI_PROVIDER === "mock";
}

// Le provider (OpenCode Go) exige un identifiant de session stable par
// conversation dans `x-opencode-session` : sans lui il repond
// 400 MissingSessionID. Il demande aussi que le client s'identifie avec son
// propre User-Agent plutot qu'un User-Agent de SDK generique.
const CLIENT_USER_AGENT = "personalbrain/1.0";

// Session des appels hors conversation (titres, resumes, extraction memoire,
// brief quotidien) : constante pour rester stable d'un appel a l'autre.
export const DEFAULT_SESSION_ID = "personalbrain";

export function getClientConfig(sessionId?: string) {
  // En mode mock, aucune requete ne part : une configuration factice suffit et
  // evite qu'un chemin secondaire (liste des modeles, demo) jette au demarrage.
  if (isMockAiEnabled()) {
    return {
      baseURL: "http://mock.invalid/v1",
      apiKey: "mock",
      defaultHeaders: {
        "User-Agent": CLIENT_USER_AGENT,
        "x-opencode-session": sessionId || DEFAULT_SESSION_ID,
      },
    };
  }
  const { NEXT_PUBLIC_API_URL: API_URL, IA_API_KEY: API_KEY } = getConfig();
  if (!API_URL || !API_KEY) {
    throw new Error(
      "Configuration IA incomplete : renseigner NEXT_PUBLIC_API_URL (URL du provider compatible OpenAI) et IA_API_KEY dans .env.local, puis redemarrer le serveur. Pour developper sans cle, utiliser AI_PROVIDER=mock."
    );
  }
  return {
    baseURL: API_URL,
    apiKey: API_KEY,
    defaultHeaders: {
      "User-Agent": CLIENT_USER_AGENT,
      "x-opencode-session": sessionId || DEFAULT_SESSION_ID,
    },
  };
}

// Le SDK Anthropic prefixe lui-meme ses routes par `/v1` (`/v1/messages`) :
// une baseURL deja terminee par `/v1` donnerait `/v1/v1/messages` (404). On
// retire donc le suffixe pour cette SDK uniquement — le SDK OpenAI, lui,
// attend la baseURL complete (`/v1/chat/completions`).
export function getAnthropicClientConfig(sessionId?: string) {
  const config = getClientConfig(sessionId);
  return { ...config, baseURL: config.baseURL.replace(/\/v1\/?$/, "") };
}

// Liste des modeles affiches quand `GET /models` est injoignable (cf.
// lib/ai-providers/models.ts, qui interroge le provider et met en cache la
// vraie liste). Un identifiant mort ici ne coute rien tant que le provider
// repond, mais autant n'y laisser que des modeles verifies vivants.
const OPENAI_MODELS: readonly string[] = [
  "deepseek-v4.1-flash",
  "glm-5.3",
  "glm-5.3-flash",
  "mimo-v2.6-pro",
  "hy4",
];

// Modeles servis par l'API Anthropic (`/v1/messages`) : le provider le declare
// dans `api.messages` ; cette liste n'est que le repli quand le cache est
// froid (cf. getModelProtocol).
const ANTHROPIC_MODELS: readonly string[] = [
  "qwen4-max",
  "qwen3.8-max",
  "qwen3.8-flash",
  "qwen3.7-plus",
  "minimax-m3",
];

export const AVAILABLE_MODELS: readonly string[] = [...OPENAI_MODELS, ...ANTHROPIC_MODELS];

export function isAnthropicModel(model: string): boolean {
  return ANTHROPIC_MODELS.includes(model);
}

// Timeout de sécurité sur les appels IA (les SDK par défaut peuvent pendre
// jusqu'à 10 minutes sans réponse du provider).
export const REQUEST_TIMEOUT_MS = 120_000;
