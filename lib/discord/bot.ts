import { buildRouterMessages, formatReply, parseToolChoice } from "./agent";
import { getDiscordConfig, isDiscordReachable } from "./config";
import type { DiscordConfig } from "./config";
import { getBotUserId, getDirectChannelId, sendPlainMessage } from "./client";
import type { DiscordSendResult } from "./types";

const BOT_STATE_FILE = "discord-bot-state.json";
const POLL_BATCH = 20;
const MODEL_TIMEOUT_MS = 20_000;

interface BotState {
  /** Dernier message utilisateur traité (curseur du polling). */
  lastMessageId: string;
}

export interface IncomingMessage {
  id: string;
  content: string;
  authorId: string;
}

const FALLBACK_REPLY =
  "Je n'ai pas d'outil pour ça. Essaie par exemple : « c'est quoi mon prochain cours ? », « mes rappels », « la météo à Paris », « mes concerts ».";

async function readBotState(): Promise<BotState> {
  try {
    const { readJsonSafe } = await import("@/lib/storage");
    const data = await readJsonSafe<BotState>(BOT_STATE_FILE, { lastMessageId: "" });
    return { lastMessageId: data.lastMessageId ?? "" };
  } catch {
    return { lastMessageId: "" };
  }
}

/**
 * Compare-and-set sur le curseur : true si personne d'autre n'a avancé depuis
 * `expected`. Sans ça, deux workers Passenger traiteraient le même message et
 * enverraient deux réponses.
 */
/**
 * Rend la reservation apres un echec technique : le message sera retraite au
 * tour suivant plutot que perdu. Sans effet si un autre worker a avance.
 */
async function releaseMessage(expected: string, claimed: string): Promise<boolean> {
  try {
    const { mutateJson } = await import("@/lib/storage-core");
    const result = await mutateJson<BotState>(BOT_STATE_FILE, { lastMessageId: "" }, (data) => {
      if ((data.lastMessageId ?? "") !== claimed) return null;
      data.lastMessageId = expected;
    });
    return result !== null;
  } catch {
    return false;
  }
}

async function claimMessage(expected: string, next: string): Promise<boolean> {
  try {
    const { mutateJson } = await import("@/lib/storage-core");
    const result = await mutateJson<BotState>(BOT_STATE_FILE, { lastMessageId: "" }, (data) => {
      if ((data.lastMessageId ?? "") !== expected) return null;
      data.lastMessageId = next;
    });
    return result !== null;
  } catch {
    return false;
  }
}

/** Messages reçus depuis le curseur, du plus ancien au plus récent. */
export async function fetchNewMessages(
  config: DiscordConfig,
  channelId: string,
  botUserId: string,
  after: string
): Promise<IncomingMessage[]> {
  const url = new URL(`https://discord.com/api/v10/channels/${channelId}/messages`);
  url.searchParams.set("limit", String(POLL_BATCH));
  if (after) url.searchParams.set("after", after);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bot ${config.token}`, "User-Agent": "backstage/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];

  const raw = (await res.json()) as {
    id: string;
    content: string;
    author?: { id: string };
  }[];

  return raw
    .filter((m) => m.author?.id !== botUserId && m.content.trim().length > 0)
    .map((m) => ({ id: m.id, content: m.content, authorId: m.author?.id ?? "" }))
    .reverse();
}

/** Demande au routeur quel outil correspond, sans l'exécuter. */
export async function chooseAction(message: string): Promise<{ tool: string; args: Record<string, unknown> } | null> {
  try {
    const { getConfig } = await import("@/lib/config");
    const { chatCompletion } = await import("@/lib/ai-providers");

    const config = await getConfig();
    const model = config.models.discordBot;
    const result = await chatCompletion(
      model,
      buildRouterMessages(message),
      [],
      AbortSignal.timeout(MODEL_TIMEOUT_MS),
      "discord-bot"
    );
    return parseToolChoice(result.content);
  } catch (err) {
    // Erreur technique (timeout, API, quota) : on la propage pour que le
    // message ne soit pas consomme et soit rejoue au tour suivant.
    throw new Error(`routeur indisponible : ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Réponse texte à un message utilisateur : routeur → outil → texte brut. */
export async function answerIncomingText(message: string): Promise<string> {
  const choice = await chooseAction(message);
  if (!choice) return FALLBACK_REPLY;

  try {
    const { executeTool } = await import("@/lib/chat-tools");
    const result = await executeTool(choice.tool, choice.args, false);
    return formatReply(result) || FALLBACK_REPLY;
  } catch (err) {
    console.warn(
      `[discord-bot] Outil en echec : ${err instanceof Error ? err.message : String(err)}`
    );
    return "Erreur interne, reessaie dans un instant.";
  }
}

/** Un tour de polling : lit le DM, répond aux nouveaux messages, avance le curseur. */
export async function pollDiscordOnce(): Promise<{ handled: number }> {
  try {
    const config = await getDiscordConfig();
    if (!isDiscordReachable(config) || !config.bot) return { handled: 0 };

    const [channelId, botUserId] = await Promise.all([
      getDirectChannelId(config),
      getBotUserId(config.token),
    ]);
    if (!channelId || !botUserId) return { handled: 0 };

    const state = await readBotState();
    const messages = await fetchNewMessages(config, channelId, botUserId, state.lastMessageId);
    if (!messages.length) return { handled: 0 };

    let handled = 0;
    for (const message of messages) {
      // CAS : si un autre worker a déjà traité ce lot, on s'arrête.
      if (!(await claimMessage(state.lastMessageId, message.id))) break;
      state.lastMessageId = message.id;

      let reply: string;
      try {
        reply = await answerIncomingText(message.content);
      } catch (err) {
        console.warn(
          `[discord-bot] ${err instanceof Error ? err.message : String(err)} — message conserve`
        );
        await releaseMessage("", message.id);
        break;
      }

      handled += 1;
      const sent: DiscordSendResult = await sendPlainMessage(config, reply);
      if (!sent.sent) {
        console.warn(`[discord-bot] Reponse non envoyee : ${sent.reason ?? "raison inconnue"}`);
      }
    }
    return { handled };
  } catch (err) {
    console.warn(
      `[discord-bot] Polling ignore : ${err instanceof Error ? err.message : String(err)}`
    );
    return { handled: 0 };
  }
}

export { FALLBACK_REPLY };