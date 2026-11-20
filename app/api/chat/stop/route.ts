import { NextRequest, NextResponse } from "next/server";
import { authedRoute } from "@/lib/route";
import { AppError } from "@/lib/errors";
import { abortRun } from "@/lib/chat-runs";
import { z } from "zod";

const stopBodySchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId requis").max(200),
});

// Arrêt explicite d'une génération (bouton Stop / Esc). Distinct de la simple
// déconnexion du client, qui n'interrompt plus la génération : sans cet
// endpoint, la fermeture d'un onglet serait indiscernable d'un Stop.
export const POST = authedRoute(async (_session, request: NextRequest) => {
  const parsed = stopBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  abortRun(parsed.data.sessionId);
  return NextResponse.json({ ok: true });
});
