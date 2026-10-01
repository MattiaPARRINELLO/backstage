import { renderEventCard } from "./cards";
import { sendDirectMessage } from "./client";
import { getDiscordConfig, isDiscordReachable } from "./config";
import { buildEmbed } from "./embed";
import type { DiscordEvent, DiscordSendResult } from "./types";

// Ce module ne journalise JAMAIS via serverLog : les alertes techniques sont
// declenchees par serverLog, une remontee ici provoquerait une boucle.
const ALERT_COOLDOWN_MS = 30 * 60_000;
const ALERT_WINDOW_MS = 60 * 60_000;
const ALERT_MAX_PER_WINDOW = 8;

const lastAlertAt = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;
let alertInFlight = false;

/** Les errances techniques citent souvent des URLs signees : on masque les
 *  jetons avant de les faire sortir de la machine. */
export function redactSecrets(text: string): string {
  return text
    .replace(
      /([?&](?:access_token|refresh_token|token|key|api[_-]?key|secret|code|password)=)[^&\s]+/gi,
      "$1***"
    )
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "***")
    .slice(0, 260);
}

/**
 * Clé de déduplication : sans neutralisation des parties variables (endpoint,
 * identifiant, chemin), « Push ÉCHEC 410 → <endpoint> » produirait une alerte
 * distincte par appareil et la dédup ne servirait à rien.
 */
export function alertKey(module: string, message: string): string {
  return `${module}:${message
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/\b[A-Za-z0-9_-]{16,}\b/g, "<id>")}`;
}

function tooManyAlerts(): boolean {
  const now = Date.now();
  if (now - windowStart > ALERT_WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount > ALERT_MAX_PER_WINDOW;
}

/**
 * Envoie un événement en DM Discord : embed + carte PNG générée.
 * Ne lève jamais — un canal cassé ne doit pas casser le scheduler.
 */
export async function notifyDiscord(event: DiscordEvent): Promise<DiscordSendResult> {
  try {
    const config = await getDiscordConfig();
    if (!isDiscordReachable(config)) {
      return { sent: false, reason: "discord non configure" };
    }
    if (event.kind !== "test") {
      const enabled = event.kind === "alert" ? config.alerts : config.events;
      if (!enabled) {
        return { sent: false, reason: "discord desactive dans les reglages" };
      }
    }

    const embed = buildEmbed(event);
    let image: { filename: string; data: Uint8Array } | null = null;
    try {
      image = {
        filename: `backstage-${event.kind}.png`,
        data: await renderEventCard(event),
      };
    } catch (err) {
      // La carte est cosmétique : l'embed texte part quand même.
      console.warn(
        `[discord] Carte image non generee : ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return await sendDirectMessage(config, { embed, image });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[discord] Notification abandonnee : ${message}`);
    return { sent: false, reason: message };
  }
}

/** Alerte technique : dédupliquée par couple module/message + plafonnée par heure. */
export async function notifyDiscordAlert(input: {
  module: string;
  message: string;
  detail?: string;
  level: "error" | "warn";
}): Promise<void> {
  if (alertInFlight) return;
  const key = alertKey(input.module, input.message);
  const now = Date.now();
  const last = lastAlertAt.get(key) ?? 0;
  if (now - last < ALERT_COOLDOWN_MS) return;
  if (tooManyAlerts()) {
    console.warn("[discord] Alertes techniques plafonnées pour cette heure");
    return;
  }
  lastAlertAt.set(key, now);

  alertInFlight = true;
  try {
    await notifyDiscord({
      kind: "alert",
      module: input.module,
      message: redactSecrets(input.message),
      detail: input.detail ? redactSecrets(input.detail) : undefined,
      level: input.level,
    });
  } finally {
    alertInFlight = false;
  }
}

export function resetAlertThrottle() {
  lastAlertAt.clear();
  windowStart = 0;
  windowCount = 0;
}
