import type { z } from "zod";

import { AppError } from "@/lib/errors";
import { requireSession } from "@/lib/session";

/**
 * Point d'entree unique d'une Server Action (issue #87).
 *
 * Il porte ce qui etait recopie a la main dans chaque fichier d'actions : la
 * session, la validation Zod de l'entree brute, et la traduction d'une entree
 * invalide en `AppError("validation")`. La logique metier reste dans le
 * `handler`, qui recoit des donnees deja validees et la session verifiee.
 */
export interface ActionSession {
  readonly userId: string;
}

export async function runAction<Schema extends z.ZodType, Result>(
  schema: Schema,
  input: unknown,
  handler: (data: z.infer<Schema>, session: ActionSession) => Promise<Result>
): Promise<Result> {
  const session = await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      "validation",
      parsed.error.issues[0]?.message ?? "Donnees invalides"
    );
  }

  return handler(parsed.data as z.infer<Schema>, session);
}
