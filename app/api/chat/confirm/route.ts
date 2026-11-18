import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runTool, toolPolicy, consumePendingAction } from "@/lib/chat-tools";
import { isFailedStatus } from "@/lib/tool-result";
import { logActivity } from "@/lib/storage";
import { applyConfirmedToolResults } from "@/lib/storage/chat-history";

// Exécute une action IA qui exige une confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Seul le client, après un clic "Confirmer" sur la carte d'action du chat,
// peut déclencher l'exécution : le modèle ne peut jamais confirmer lui-même.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: {
    name?: string;
    arguments?: Record<string, unknown>;
    sessionId?: unknown;
    toolCallId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const toolCallId = typeof body?.toolCallId === "string" ? body.toolCallId : "";
  const args =
    body?.arguments && typeof body.arguments === "object"
      ? (body.arguments as Record<string, unknown>)
      : {};

  // Seuls les outils réellement proposables à la confirmation sont
  // exécutables via cette route : elle ne doit jamais devenir une porte
  // d'exécution arbitraire des outils. Le registre ci-dessous reste
  // l'autorisation finale (action réellement proposée, usage unique).
  if (!toolPolicy(name).confirmable) {
    return NextResponse.json({ error: "Action non confirmable" }, { status: 400 });
  }

  // Le nom et les arguments doivent correspondre à une action réellement
  // proposée par le serveur (usage unique) : une action inventée, substituée
  // ou rejouée est refusée AVANT tout effet de bord.
  const reason = consumePendingAction(name, args);
  if (!reason) {
    return NextResponse.json({ error: "Action non confirmee par le serveur" }, { status: 400 });
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
      return NextResponse.json({ error: run.text }, { status: 500 });
    }
    const details = JSON.stringify(args).slice(0, 150);
    await logActivity("ai_action", `Action IA exécutée : ${name}`, details).catch(() => {});
    return NextResponse.json({ ok: true, result: run.text, status: run.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat/confirm] Échec de ${name}:`, message);
    await logActivity("ai_action", `Action IA échouée : ${name}`, message).catch(() => {});
    return NextResponse.json({ error: "L'action a échoué côté serveur" }, { status: 500 });
  }
}
