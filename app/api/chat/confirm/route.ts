import { NextResponse } from "next/server";
import { z } from "zod";
import { runTool, toolPolicy, consumePendingAction } from "@/lib/chat-tools";
import { isFailedStatus } from "@/lib/tool-result";
import { logActivity } from "@/lib/storage";
import { applyConfirmedToolResults } from "@/lib/storage/chat-history";
import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";

const confirmSchema = z.object({
  name: z.string({ error: "Nom d'outil requis" }).min(1, "Nom d'outil requis"),
  arguments: z.record(z.string(), z.unknown()).optional(),
  sessionId: z.string().optional(),
  toolCallId: z.string().optional(),
});

// Exécute une action IA qui exige une confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Seul le client, après un clic "Confirmer" sur la carte d'action du chat,
// peut déclencher l'exécution : le modèle ne peut jamais confirmer lui-même.
export const POST = authedRoute(async (_session, request: Request) => {
  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Corps de requête invalide");
  }
  const { name } = parsed.data;
  const sessionId = parsed.data.sessionId ?? "";
  const toolCallId = parsed.data.toolCallId ?? "";
  const args = parsed.data.arguments ?? {};

  // Seuls les outils réellement proposables à la confirmation sont
  // exécutables via cette route : elle ne doit jamais devenir une porte
  // d'exécution arbitraire des outils. Le registre ci-dessous reste
  // l'autorisation finale (action réellement proposée, usage unique).
  if (!toolPolicy(name).confirmable) {
    throw new AppError("validation", "Action non confirmable");
  }

  // Le nom et les arguments doivent correspondre à une action réellement
  // proposée par le serveur (usage unique) : une action inventée, substituée
  // ou rejouée est refusée AVANT tout effet de bord.
  const reason = consumePendingAction(name, args);
  if (!reason) {
    throw new AppError("validation", "Action non confirmee par le serveur");
  }

  try {
    const run = await runTool(name, args, true);
    if (toolCallId) {
      await applyConfirmedToolResults(sessionId, [
        { toolCallId, status: run.status, result: run.text },
      ]);
    }
    if (isFailedStatus(run.status)) {
      console.error(`[chat/confirm] Échec de ${name}:`, run.text);
      await logActivity("ai_action", `Action IA échouée : ${name}`, run.text).catch(() => {});
      throw new AppError("internal", run.text);
    }
    const details = JSON.stringify(args).slice(0, 150);
    await logActivity("ai_action", `Action IA exécutée : ${name}`, details).catch(() => {});
    return NextResponse.json({ ok: true, result: run.text, status: run.status });
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat/confirm] Échec de ${name}:`, message);
    await logActivity("ai_action", `Action IA échouée : ${name}`, message).catch(() => {});
    throw new AppError("internal", "L'action a échoué côté serveur");
  }
});
