import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  runTool,
  toolPolicy,
  consumePendingAction,
  hasPendingAction,
  pendingActionKey,
} from "@/lib/chat-tools";
import { isFailedStatus, type ToolStatus } from "@/lib/tool-result";
import { logActivity } from "@/lib/storage";
import { applyConfirmedToolResults } from "@/lib/storage/chat-history";

// Exécute un LOT d'actions IA exigeant la confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Une seule carte de confirmation est affichée pour le lot ; ce endpoint
// exécute chaque action après le clic « Confirmer tout ». Chaque nom doit
// figurer parmi les outils confirmables : jamais de porte d'exécution
// arbitraire.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: {
    actions?: { name?: unknown; arguments?: unknown; toolCallId?: unknown }[];
    sessionId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const actions = Array.isArray(body?.actions) ? body.actions : [];
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (actions.length === 0) {
    return NextResponse.json({ error: "Aucune action à confirmer" }, { status: 400 });
  }

  const invalid = actions.find((a) => !a || typeof a.name !== "string" || !toolPolicy(a.name).confirmable);
  if (invalid) {
    return NextResponse.json({ error: "Action non confirmable" }, { status: 400 });
  }

  // Validation INTÉGRALE du lot avant tout effet de bord : une action absente
  // du registre serveur (inventée, substituée ou déjà consommée) ou un doublon
  // dans le lot refuse le lot entier, sans exécution partielle.
  const normalized: {
    name: string;
    args: Record<string, unknown>;
    toolCallId?: string;
  }[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const name = action.name as string;
    const toolCallId =
      typeof action.toolCallId === "string" ? action.toolCallId : undefined;
    const args =
      action.arguments && typeof action.arguments === "object"
        ? (action.arguments as Record<string, unknown>)
        : {};
    const key = pendingActionKey(name, args);
    if (seen.has(key)) {
      return NextResponse.json({ error: "Lot invalide : action en double" }, { status: 400 });
    }
    seen.add(key);
    if (!hasPendingAction(name, args)) {
      return NextResponse.json({ error: "Action non confirmee par le serveur" }, { status: 400 });
    }
    normalized.push({ name, args, toolCallId });
  }

  const results: {
    name: string;
    toolCallId?: string;
    ok: boolean;
    status: ToolStatus;
    result?: string;
    error?: string;
  }[] = [];
  for (const { name, args, toolCallId } of normalized) {
    // Consommation juste avant l'exécution : une action ne s'exécute qu'une
    // seule fois, même si la même requête est rejouée.
    const reason = consumePendingAction(name, args);
    if (!reason) {
      return NextResponse.json({ error: "Action non confirmee par le serveur" }, { status: 400 });
    }
    const run = await runTool(name, args, true);
    // Le statut machine fait foi : un texte « Rappel introuvable. » renvoyé
    // sans lever d'exception n'est PAS un succès. Le client affiche donc un
    // échec plutôt qu'un « ✓ fait » mensonger.
    const ok = !isFailedStatus(run.status);
    if (ok) {
      results.push({ name, toolCallId, ok, status: run.status, result: run.text });
      await logActivity("ai_action", `Action IA exécutée : ${name}`, JSON.stringify(args).slice(0, 150)).catch(() => {});
    } else {
      console.error(`[chat/confirm-batch] Échec de ${name}:`, run.text);
      await logActivity("ai_action", `Action IA échouée : ${name}`, run.text).catch(() => {});
      results.push({ name, toolCallId, ok, status: run.status, error: run.text });
    }
  }

  // L'historique serveur reflète l'état réel : sans ce report, un rechargement
  // rejouerait le `[BLOQUE]` d'avant la confirmation (issue #141).
  await applyConfirmedToolResults(
    sessionId,
    results
      .filter((r) => r.toolCallId)
      .map((r) => ({
        toolCallId: r.toolCallId as string,
        status: r.status,
        result: r.ok ? (r.result ?? "OK") : (r.error ?? "Échec"),
      }))
  );

  return NextResponse.json({ ok: true, results });
}
