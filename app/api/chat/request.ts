import { z } from "zod";

/**
 * Validation de la charge utile de `POST /api/chat`.
 *
 * Le handler garde la lecture de `request.json()` et la reponse HTTP ; ce
 * module ne connait que des donnees deja parsees. Il ne touche ni aux outils,
 * ni au streaming, ni au prompt.
 */
export const chatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().optional(),
        toolCalls: z
          .array(
            z.object({
              id: z.string(),
              name: z.string(),
              arguments: z.string(),
            })
          )
          .optional(),
      })
    )
    .min(1, "Au moins un message est requis"),
  model: z.enum(["general", "code"]).optional(),
  sessionId: z.string().trim().min(1).max(200).optional(),
  // Résultats d'actions à effet de bord (confirmations comprises), transmis
  // par le client : le modèle reprend la conversation avec l'état réel.
  actionContext: z.string().max(4000).optional(),
});

export type ChatBody = z.infer<typeof chatBodySchema>;

export type ChatBodyResult =
  | { ok: true; body: ChatBody }
  | { ok: false; message: string };

/** Message affiche pour toute charge utile refusee par le schema. */
export const INVALID_CHAT_BODY_MESSAGE =
  "Corps de requête invalide : messages (tableau non vide avec role et content) requis.";

/**
 * Valide une charge utile deja parsee (`JSON.parse` fait par l'appelant).
 * Le resultat discrimine laisse Zod typer `body`, sans cast cote handler.
 */
export function parseChatBody(payload: unknown): ChatBodyResult {
  const parsed = chatBodySchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: INVALID_CHAT_BODY_MESSAGE };
  }
  return { ok: true, body: parsed.data };
}
