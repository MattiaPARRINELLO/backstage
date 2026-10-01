import type { DiscordConfig } from "./config";
import type { DiscordEmbed, DiscordPayload, DiscordSendResult } from "./types";

const API_BASE = process.env.DISCORD_API_BASE?.replace(/\/$/, "") || "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

// Cache du salon DM : Discord renvoie toujours le meme salon prive pour un
// couple bot/utilisateur, le reouvrir a chaque envoi serait un appel perdu.
let cachedChannelId: string | null = null;

async function discordFetch(
  token: string,
  path: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "User-Agent": "backstage/1.0",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // corps non JSON (HTML d'erreur Cloudflare) : garde le texte brut
  }
  return { ok: res.ok, status: res.status, body };
}

function extractChannelId(body: unknown): string | null {
  if (body && typeof body === "object" && "id" in body) {
    const id = (body as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

function apiErrorMessage(body: unknown): string {
  if (typeof body === "string") return body.slice(0, 200);
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "reponse Discord illisible";
}

type ChannelResult = { id: string } | { error: string };

/** Ouvre (ou retrouve) le salon prive bot ↔ utilisateur. */
export async function openDirectChannel(token: string, userId: string): Promise<ChannelResult> {
  const { ok, body } = await discordFetch(token, "/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!ok) {
    const error = apiErrorMessage(body);
    console.warn(`[discord] Ouverture du DM refusee : ${error}`);
    return { error };
  }
  const id = extractChannelId(body);
  return id ? { id } : { error: "salon DM illisible" };
}

function buildMessageBody(payload: DiscordPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    embeds: [payload.embed],
    allowed_mentions: { parse: [] },
  };
  if (payload.image) {
    body.attachments = [{ id: 0, filename: payload.image.filename }];
  }
  return body;
}

async function postMessage(
  token: string,
  channelId: string,
  payload: DiscordPayload
): Promise<DiscordSendResult> {
  const body = buildMessageBody(payload);

  let init: RequestInit;
  if (payload.image) {
    if (payload.image.data.byteLength > MAX_ATTACHMENT_BYTES) {
      return { sent: false, reason: "image trop volumineuse" };
    }
    const form = new FormData();
    form.append("payload_json", JSON.stringify(body));
    form.append(
      "files[0]",
      new Blob([new Uint8Array(payload.image.data)], { type: "image/png" }),
      payload.image.filename
    );
    init = { method: "POST", body: form };
  } else {
    init = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
  }

  const { ok, status, body: responseBody } = await discordFetch(
    token,
    `/channels/${channelId}/messages`,
    init
  );
  if (ok) return { sent: true };
  return { sent: false, reason: `${status} — ${apiErrorMessage(responseBody)}` };
}

/** Envoie un embed (avec sa carte PNG) en DM. Ne leve jamais : le scheduler ne
 *  doit pas s'arreter sur un echec Discord. */
export async function sendDirectMessage(
  config: DiscordConfig,
  payload: DiscordPayload
): Promise<DiscordSendResult> {
  try {
    let channelId = cachedChannelId;
    if (!channelId) {
      const opened = await openDirectChannel(config.token, config.userId);
      if ("error" in opened) {
        return { sent: false, reason: `salon DM introuvable — ${opened.error}` };
      }
      channelId = opened.id;
      cachedChannelId = channelId;
    }

    let result = await postMessage(config.token, channelId, payload);
    if (!result.sent && result.reason?.startsWith("404")) {
      // Salon supprime (DM ferme par l'utilisateur) : on en rouvre un et on retente.
      cachedChannelId = null;
      const reopened = await openDirectChannel(config.token, config.userId);
      if ("error" in reopened) return result;
      channelId = reopened.id;
      cachedChannelId = channelId;
      result = await postMessage(config.token, channelId, payload);
    }
    if (!result.sent) {
      console.warn(`[discord] Envoi DM echoue : ${result.reason ?? "raison inconnue"}`);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[discord] Envoi DM impossible : ${message}`);
    return { sent: false, reason: message };
  }
}

/** Test de connexion depuis /settings (validation explicite demandee). */
export async function verifyConnection(
  config: DiscordConfig
): Promise<{ ok: boolean; detail: string }> {
  try {
    const { ok, body } = await discordFetch(config.token, "/users/@me", { method: "GET" });
    if (!ok) return { ok: false, detail: apiErrorMessage(body) };
    const name =
      body && typeof body === "object" && "username" in body
        ? String((body as { username?: unknown }).username)
        : "bot";
    const channel = await openDirectChannel(config.token, config.userId);
    return "id" in channel
      ? { ok: true, detail: `Connecte en tant que ${name}` }
      : { ok: false, detail: `Bot valide mais DM impossible — ${channel.error}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export function resetChannelCache() {
  cachedChannelId = null;
}

export type { DiscordEmbed };
