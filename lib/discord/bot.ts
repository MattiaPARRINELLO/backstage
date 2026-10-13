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

async function readBotState(): Promise<BotState | null> {
  try {
    const { readJsonSafe } = await import("@/lib/storage");
    const data = await readJsonSafe<BotState>(BOT_STATE_FILE, { lastMessageId: "" });
    return { lastMessageId: data.lastMessageId ?? "" };
  } catch {
    // Curseur illisible : on renonce au tour plutôt que de repartir de zero,
    // ce rejouerait tout l'historique du DM (reponses en double).
    return null;
  }
}

/**
 * Compare-and-set sur le curseur : true si personne d'autre n'a avancé depuis
 * `expected`. Sans ça, deux workers Passenger traiteraient le même message et
 * enverraient deux réponses.
 */
/**
 * Rend la reservation apres un echec technique : le curseur revient a sa
 * valeur d'AVANT la reservation (`previous`), donc seul ce message est
 * retraite au tour suivant. Revenir a "" rejouerait tout l'historique du DM
 * et renverrait des reponses en double. Sans effet si un autre worker a
 * avance entre-temps.
 */
async function releaseMessage(previous: string, claimed: string): Promise<boolean> {
  try {
    const { mutateJson } = await import("@/lib/storage-core");
    const result = await mutateJson<BotState>(BOT_STATE_FILE, { lastMessageId: "" }, (data) => {
      if ((data.lastMessageId ?? "") !== claimed) return null;
      data.lastMessageId = previous;
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
    const { runTool } = await import("@/lib/chat-tools");
    const run = await runTool(choice.tool, choice.args, false);
    // Statut explicite : on ne renvoie jamais un texte de succès pour un
    // outil qui a échoué (le bot dirait « voilà » alors que rien n'a été fait).
    if (run.status === "error") return "Je n'ai pas reussi a repondre (echec de l'outil). Reessaie dans un instant.";
    return formatReply(run.text) || FALLBACK_REPLY;
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
    if (!state) return { handled: 0 };
    const messages = await fetchNewMessages(config, channelId, botUserId, state.lastMessageId);
    if (!messages.length) return { handled: 0 };

    let handled = 0;
    for (const message of messages) {
      // Position du curseur avant cette reservation : c'est elle qu'il faut
      // restaurer en cas d'echec, pas la chaine vide.
      const previous = state.lastMessageId;
      // CAS : si un autre worker a déjà traité ce lot, on s'arrête.
      if (!(await claimMessage(previous, message.id))) break;
      state.lastMessageId = message.id;

      let reply: string;
      try {
        reply = await answerIncomingText(message.content);
      } catch (err) {
        console.warn(
          `[discord-bot] ${err instanceof Error ? err.message : String(err)} — message conserve`
        );
        // Le curseur revient avant ce message : il sera retenté, et lui seul.
        await releaseMessage(previous, message.id);
        break;
      }

      handled += 1;
      const sent: DiscordSendResult = await sendPlainMessage(config, reply);
      if (!sent.sent) {
        // Réponse non partie : on rend le message pour le retenter plutôt que
        // de le perdre (le curseur n'aurait servi à rien).
        console.warn(`[discord-bot] Reponse non envoyee : ${sent.reason ?? "raison inconnue"} — message retente au prochain tour`);
        await releaseMessage(previous, message.id);
        break;
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