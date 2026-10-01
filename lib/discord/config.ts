import { getConfig } from "@/lib/config";

/** Identifiants Discord (token en env uniquement — jamais persisté ni loggé). */
export interface DiscordCredentials {
  token: string;
  userId: string;
}

export interface DiscordConfig extends DiscordCredentials {
  /** Notifications d'événements (cours, rappels, relances, brief du jour). */
  events: boolean;
  /** Alertes techniques issues de serverLog. */
  alerts: boolean;
}

export function getDiscordCredentials(): DiscordCredentials {
  return {
    token: process.env.DISCORD_BOT_TOKEN?.trim() || "",
    userId: process.env.DISCORD_USER_ID?.trim() || "",
  };
}

/**
 * Config effective : env Discord (token + destinataire) croisée avec les
 * réglages persistés (`data/config.json`). Le token reste exclusivement en
 * variable d'environnement ; l'ID utilisateur peut être saisi dans /settings.
 */
export async function getDiscordConfig(): Promise<DiscordConfig> {
  const env = getDiscordCredentials();
  const config = await getConfig();
  return {
    token: env.token,
    userId: config.discord?.userId?.trim() || env.userId,
    events: config.features.discordNotifications !== false,
    alerts: config.discord?.alerts !== false,
  };
}

/** true si un DM peut réellement partir (token + destinataire). */
export function isDiscordReachable(config: DiscordConfig): boolean {
  return Boolean(config.token && config.userId);
}
