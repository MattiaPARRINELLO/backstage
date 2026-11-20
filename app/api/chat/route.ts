import { NextRequest, NextResponse } from "next/server";
import { createRun } from "@/lib/chat-runs";
import { DEFAULT_SESSION_ID } from "@/lib/ai-providers/config";
import { getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseChatBody, type ChatBody } from "./request";
import { prepareTurnContext } from "./turn-context";
import { runGeneration } from "./generation";
import { createChatStream } from "./sse-stream";

/**
 * `POST /api/chat` : point d'entree d'un tour de chat.
 *
 * Responsabilite unique : authentifier, limiter, valider la requete, puis
 * brancher les unites du tour (contexte, generation, flux SSE). La logique
 * vit dans les modules voisins ; le handler ne garde que le contrat HTTP.
 */
export async function POST(request: NextRequest) {
  // Garde d'authentification dans le handler (le middleware protege deja la
  // route, mais un bypass du middleware ne doit pas exposer le chat).
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit keye sur l'identite serveur seule : application mono-utilisateur,
  // une seule identite, donc un budget partage. Aucune valeur cliente
  // (x-forwarded-for est controlable) ne peut creer de bucket neuf.
  if (!checkRateLimit(`chat:${session.userId}`)) {
    return new Response(JSON.stringify({ error: "Trop de requêtes. Réessaie dans une minute." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ChatBody;
  try {
    const result = parseChatBody(await request.json());
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    body = result.body;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // Identifiant de session transmis au provider (routage + cache de prompt) :
  // celui de la conversation cote client, sinon une session globale stable.
  const sessionId = body.sessionId || DEFAULT_SESSION_ID;

  const context = await prepareTurnContext(body, sessionId);
  const run = createRun(sessionId);

  const stream = createChatStream(run, ({ send, close }) =>
    runGeneration({
      messages: context.messages,
      bodyMessages: context.bodyMessages,
      provenance: { tainted: context.provenanceTainted },
      sessionId,
      modelName: context.modelName,
      altModel: context.altModel,
      lastUserContent: context.lastUserContent,
      run,
      send,
      closeStream: close,
    })
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Desactive le buffering des proxys (nginx) sur ce flux.
      "X-Accel-Buffering": "no",
    },
  });
}
