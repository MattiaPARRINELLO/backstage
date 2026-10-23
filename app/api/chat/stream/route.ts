import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getRun, snapshotOf, subscribe } from "@/lib/chat-runs";
import type { ChatTransportEvent } from "@/lib/chat-run-types";

// Réattachement à une génération en cours. Utilisé quand le client revient sur
// une conversation (changement de page, onglet fermé puis rouvert) : renvoie un
// instantané de l'état courant, puis la suite du flux en direct.
//
// 204 = aucune génération active pour cette conversation.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Non authentifie" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return new Response(JSON.stringify({ error: "sessionId requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const run = getRun(sessionId);
  if (!run) return new Response(null, { status: 204 });

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        closed = true;
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          // Déjà fermé : sans conséquence.
        }
      };

      const write = (event: ChatTransportEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Abonnement d'abord (aucun évènement ne peut être manqué : on est dans
      // le même tour de boucle), puis rejeu de l'instantané courant.
      unsubscribe = subscribe(
        run,
        (event) => {
          write(event);
          if (event.type === "done") close();
        },
        false
      );

      write(snapshotOf(run));
      if (run.finished) {
        write({ type: "done", content: run.doneContent });
        close();
      }
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
