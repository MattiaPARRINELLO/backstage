import { NextResponse } from "next/server";

import { toErrorPayload } from "@/lib/errors";
import { requireSession } from "@/lib/session";

/**
 * Enveloppe des Route Handlers prives (issue #87).
 *
 * Elle porte la session et la traduction des erreurs : toute exception devient
 * une reponse JSON `{ error, code }` avec le statut du code. Un bug inconnu est
 * journalise cote serveur et renvoye en `internal` sans son message technique.
 */
type RouteArgs = unknown[];

export function apiRoute<Args extends RouteArgs, Result extends Response>(
  handler: (...args: Args) => Promise<Result> | Result
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Une reponse d'erreur est un `Response` : le type de retour du handler
      // est conserve pour les tests et les `NextResponse.cookies`.
      return errorResponse(error) as Result;
    }
  };
}

export function authedRoute<Args extends RouteArgs, Result extends Response>(
  handler: (session: { userId: string }, ...args: Args) => Promise<Result> | Result
): (...args: Args) => Promise<Result> {
  return apiRoute(async (...args: Args) => {
    const session = await requireSession();
    return handler(session, ...args);
  });
}

export function errorResponse(error: unknown): Response {
  const payload = toErrorPayload(error);
  if (payload.code === "internal") {
    console.error("[api]", error);
  }
  return NextResponse.json(
    { error: payload.message, code: payload.code },
    { status: payload.status }
  );
}
