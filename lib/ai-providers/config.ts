const API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.IA_API_KEY;

// Le provider (OpenCode Go) exige un identifiant de session stable par
// conversation dans `x-opencode-session` : sans lui il repond
// 400 MissingSessionID. Il demande aussi que le client s'identifie avec son
// propre User-Agent plutot qu'un User-Agent de SDK generique.
const CLIENT_USER_AGENT = "personalbrain/1.0";

// Session des appels hors conversation (titres, resumes, extraction memoire,
// brief quotidien) : constante pour rester stable d'un appel a l'autre.
export const DEFAULT_SESSION_ID = "personalbrain";

export function getClientConfig(sessionId?: string) {
  if (!API_URL || !API_KEY) {
    throw new Error("NEXT_PUBLIC_API_URL et IA_API_KEY doivent etre configures");
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
  "deepseek-v4-pro",
  "kimi-k2.7-code",
];

// Modeles servis par l'API Anthropic (`/v1/messages`) : le provider le declare
// dans `api.messages` ; cette liste n'est que le repli quand le cache est
// froid (cf. getModelProtocol).
const ANTHROPIC_MODELS: readonly string[] = [
  "claude-haiku-5-5",
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
