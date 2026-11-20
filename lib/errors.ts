/**
 * Taxonomie d'erreurs serveur (issue #87).
 *
 * Le noyau ne renvoie jamais un message brut au client : toute erreur porte un
 * `code` stable, documente dans `docs/architecture.md` (§ Codes d'erreur), qui
 * decide du statut HTTP et du texte affichable. Les libelles sont en francais
 * sans accent, comme les autres messages utilisateur du depot.
 */

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation"
  | "external_unavailable"
  | "internal";

export const ERROR_CODES: readonly ErrorCode[] = [
  "unauthenticated",
  "forbidden",
  "not_found",
  "validation",
  "external_unavailable",
  "internal",
];

const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  external_unavailable: 503,
  internal: 500,
};

const UI_LABEL: Record<ErrorCode, string> = {
  unauthenticated: "Session expiree, reconnecte-toi.",
  forbidden: "Action non autorisee.",
  not_found: "Element introuvable.",
  validation: "Donnees invalides.",
  external_unavailable: "Service externe indisponible, reessaie plus tard.",
  internal: "Une erreur interne est survenue.",
};

/** Erreur applicative : `message` est destine a l'utilisateur, `cause` au log. */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    if (options && "cause" in options) this.cause = options.cause;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Statut HTTP d'un code, pour les Route Handlers. */
export function errorStatus(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/** Libelle pret a afficher pour un code, cote client comme cote serveur. */
export function errorLabel(code: ErrorCode): string {
  return UI_LABEL[code];
}

export interface ErrorPayload {
  readonly code: ErrorCode;
  readonly message: string;
  readonly status: number;
}

/**
 * Traduit n'importe quelle erreur en charge utile stable.
 *
 * Une erreur inconnue devient `internal` et son message technique n'est jamais
 * expose : il part dans le log de l'appelant, pas dans la reponse.
 */
export function toErrorPayload(error: unknown): ErrorPayload {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, status: HTTP_STATUS[error.code] };
  }

  if (error instanceof Error && error.name === "ZodError") {
    return { code: "validation", message: UI_LABEL.validation, status: HTTP_STATUS.validation };
  }

  return { code: "internal", message: UI_LABEL.internal, status: HTTP_STATUS.internal };
}
