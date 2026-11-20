import type { StreamEvent } from "@/lib/ai-providers";
import { publish, subscribe, finishRun, type ChatRun } from "@/lib/chat-runs";

/**
 * Flux SSE d'un tour de chat, branche sur le registre des runs.
 *
 * Responsabilite unique : transporter les evenements (abonnement, battement de
 * coeur, fermeture, annulation). Le module ne connait ni le modele, ni les
 * outils : `runTurn` produit les evenements via `send`.
 */

export interface ChatStreamIo {
  /** Met a jour l'instantane serveur puis diffuse aux abonnes. */
  send: (event: StreamEvent) => void;
  /** Ferme le flux HTTP courant (la generation est terminee). */
  close: () => void;
}

export function createChatStream(
  run: ChatRun,
  runTurn: (io: ChatStreamIo) => Promise<void>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // Registre serveur : la generation survit a la deconnexion du client. Le
  // flux HTTP peut etre annule (navigation, onglet ferme), la boucle IA
  // continue et ecrit la reponse dans l'historique.
  let streamClosed = false;
  let generationStarted = false;
  let unsubscribe: (() => void) | null = null;
  let stopHeartbeat: (() => void) | null = null;

  return new ReadableStream({
    async start(controller) {
      generationStarted = true;
      // Abonnement du flux HTTP courant. `replay: false` : le client qui vient
      // d'envoyer la requete n'a pas besoin de l'instantane initial.
      unsubscribe = subscribe(
        run,
        (event) => {
          if (streamClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            streamClosed = true;
          }
        },
        false
      );

      // Battement de coeur SSE : sans trafic pendant une longue recherche
      // d'outil, un proxy (Apache/Passenger, nginx) peut considerer la
      // connexion inactive et la couper. Un commentaire SSE tous les 15 s la
      // garde ouverte sans rien changer cote client.
      const heartbeat = setInterval(() => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          streamClosed = true;
        }
      }, 15_000);
      (heartbeat as { unref?: () => void }).unref?.();
      stopHeartbeat = () => clearInterval(heartbeat);

      function closeStream() {
        stopHeartbeat?.();
        stopHeartbeat = null;
        unsubscribe?.();
        unsubscribe = null;
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // Deja ferme cote client : sans consequence.
        }
      }

      function send(data: StreamEvent) {
        // Met a jour l'instantane serveur puis diffuse aux abonnes (flux HTTP
        // courant et eventuels clients reattaches).
        publish(run, data);
      }

      await runTurn({ send, close: closeStream });
    },
    cancel() {
      // Le client a ferme la connexion (navigation, onglet ferme, reseau) :
      // on ne coupe PAS la generation. Elle continue cote serveur, ecrit sa
      // reponse dans l'historique et reste recuperable via
      // GET /api/chat/stream. Seul /api/chat/stop l'interrompt.
      stopHeartbeat?.();
      stopHeartbeat = null;
      streamClosed = true;
      unsubscribe?.();
      unsubscribe = null;
      // Le flux a ete annule avant meme que la generation demarre : aucun tour
      // ne viendra le cloturer, on libere le run tout de suite.
      if (!generationStarted) finishRun(run);
    },
  });
}
