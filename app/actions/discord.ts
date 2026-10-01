"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateConfig } from "@/lib/config";
import { verifyConnection } from "@/lib/discord/client";
import { getDiscordConfig } from "@/lib/discord/config";
import { notifyDiscord } from "@/lib/discord/notify";
import { requireSession } from "@/lib/session";

export interface DiscordStatus {
  /** DISCORD_BOT_TOKEN présent dans l'environnement. */
  botConfigured: boolean;
  /** Identifiant du destinataire des DM. */
  userId: string;
  events: boolean;
  alerts: boolean;
  /** Un DM peut réellement partir (bot + destinataire). */
  ready: boolean;
}

async function currentStatus(): Promise<DiscordStatus> {
  const config = await getDiscordConfig();
  return {
    botConfigured: Boolean(config.token),
    userId: config.userId,
    events: config.events,
    alerts: config.alerts,
    ready: Boolean(config.token && config.userId),
  };
}

export async function loadDiscordStatus(): Promise<DiscordStatus> {
  await requireSession();
  return currentStatus();
}

const updateDiscordSchema = z
  .object({
    userId: z
      .string()
      .trim()
      .max(32, "Identifiant trop long")
      .regex(/^\d*$/, "Identifiant Discord numerique attendu"),
    events: z.boolean(),
    alerts: z.boolean(),
  })
  .strict();

export async function updateDiscordSettings(input: {
  userId: string;
  events: boolean;
  alerts: boolean;
}): Promise<DiscordStatus> {
  await requireSession();

  const parsed = updateDiscordSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  await updateConfig({
    discord: { userId: parsed.data.userId, alerts: parsed.data.alerts },
    features: { discordNotifications: parsed.data.events },
  });
  revalidatePath("/settings");

  return currentStatus();
}

// Envoie un DM de contrôle : vérifie le bot ET la carte image avant de faire
// confiance au canal pour les vraies notifications.
export async function testDiscordNotification(): Promise<{ sent: boolean; detail: string }> {
  await requireSession();

  const config = await getDiscordConfig();
  if (!config.token) {
    return { sent: false, detail: "DISCORD_BOT_TOKEN absent de l'environnement" };
  }
  if (!config.userId) {
    return { sent: false, detail: "Identifiant utilisateur manquant" };
  }

  const verify = await verifyConnection(config);
  if (!verify.ok) {
    return { sent: false, detail: verify.detail };
  }

  const result = await notifyDiscord({ kind: "test" });
  return {
    sent: result.sent,
    detail: result.sent ? `${verify.detail} — DM envoye` : result.reason ?? "envoi impossible",
  };
}
