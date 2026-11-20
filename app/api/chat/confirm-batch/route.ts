import { NextResponse } from "next/server";
import { z } from "zod";
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
import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";

const batchSchema = z.object({
  actions: z
    .array(
      z.object({
        name: z.string({ error: "Nom d'outil requis" }).min(1, "Nom d'outil requis"),
        arguments: z.record(z.string(), z.unknown()).optional(),
        toolCallId: z.string().optional(),
      })
    )
    .min(1, "Aucune action à confirmer")
    .max(50),
  sessionId: z.string().optional(),
});

// Exécute un LOT d'actions IA exigeant la confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Une seule carte de confirmation est affichée pour le lot ; ce endpoint
// exécute chaque action après le clic « Confirmer tout ». Chaque nom doit
// figurer parmi les outils confirmables : jamais de porte d'exécution
// arbitraire.
export const POST = authedRoute(async (_session, request: Request) => {
  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Corps de requête invalide");
  }
  const { actions } = parsed.data;
  const sessionId = parsed.data.sessionId ?? "";

  const invalid = actions.find((a) => !toolPolicy(a.name).confirmable);
  if (invalid) {
    throw new AppError("validation", "Action non confirmable");
  }

  // Validation INTÉGRALE du lot avant tout effet de bord : une action absente
  // du registre serveur (inventée, substituée ou déjà consommée) ou un doublon
  // dans le lot refuse le lot entier, sans exécution partielle.
  const normalized: { name: string; args: Record<string, unknown>; toolCallId?: string }[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const args = action.arguments ?? {};
    const key = pendingActionKey(action.name, args);
    if (seen.has(key)) {
      throw new AppError("validation", "Lot invalide : action en double");
    }
    seen.add(key);
    if (!hasPendingAction(action.name, args)) {
      throw new AppError("validation", "Action non confirmee par le serveur");
    }
    normalized.push({ name: action.name, args, toolCallId: action.toolCallId });
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
      throw new AppError("validation", "Action non confirmee par le serveur");
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
});
