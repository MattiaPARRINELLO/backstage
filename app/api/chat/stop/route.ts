import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { abortRun } from "@/lib/chat-runs";
import { z } from "zod";

const stopBodySchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId requis").max(200),
});

// Arrêt explicite d'une génération (bouton Stop / Esc). Distinct de la simple
// déconnexion du client, qui n'interrompt plus la génération : sans cet
// endpoint, la fermeture d'un onglet serait indiscernable d'un Stop.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide" }, { status: 400 });
  }

  const parsed = stopBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload invalide" },
      { status: 400 }
    );
  }

  abortRun(parsed.data.sessionId);
  return NextResponse.json({ ok: true });
}
