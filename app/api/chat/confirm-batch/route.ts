import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { runTool, REQUIRE_CONFIRMATION } from "@/lib/chat-tools";
import { isFailedStatus, type ToolStatus } from "@/lib/tool-result";
import { logActivity } from "@/lib/storage";

// Exécute un LOT d'actions IA exigeant la confirmation utilisateur (outils à
// effet externe : envoi d'email, calendrier, notification, scan d'emails).
// Une seule carte de confirmation est affichée pour le lot ; ce endpoint
// exécute chaque action après le clic « Confirmer tout ». Chaque nom doit
// être dans REQUIRE_CONFIRMATION : jamais de porte d'exécution arbitraire.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { actions?: { name?: unknown; arguments?: unknown }[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const actions = Array.isArray(body?.actions) ? body.actions : [];
  if (actions.length === 0) {
    return NextResponse.json({ error: "Aucune action à confirmer" }, { status: 400 });
  }

  const invalid = actions.find((a) => !a || typeof a.name !== "string" || !REQUIRE_CONFIRMATION.has(a.name));
  if (invalid) {
    return NextResponse.json({ error: "Action non confirmable" }, { status: 400 });
  }

  const results: { name: string; ok: boolean; status: ToolStatus; result?: string; error?: string }[] = [];
  for (const action of actions) {
    const name = action.name as string;
    const args =
      action.arguments && typeof action.arguments === "object"
        ? (action.arguments as Record<string, unknown>)
        : {};
    const run = await runTool(name, args, true);
    // Le statut machine fait foi : un texte « Rappel introuvable. » renvoyé
    // sans lever d'exception n'est PAS un succès. Le client affiche donc un
    // échec plutôt qu'un « ✓ fait » mensonger.
    const ok = !isFailedStatus(run.status);
    if (ok) {
      results.push({ name, ok, status: run.status, result: run.text });
      await logActivity("ai_action", `Action IA exécutée : ${name}`, JSON.stringify(args).slice(0, 150)).catch(() => {});
    } else {
      console.error(`[chat/confirm-batch] Échec de ${name}:`, run.text);
      await logActivity("ai_action", `Action IA échouée : ${name}`, run.text).catch(() => {});
      results.push({ name, ok, status: run.status, error: run.text });
    }
  }

  return NextResponse.json({ ok: true, results });
}
