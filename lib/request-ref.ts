/**
 * Reference de requete visible cote client (issue #91).
 *
 * `proxy.ts` pose `x-request-id` sur la reponse et la meme valeur dans un cookie
 * lisible : un écran d'erreur client ne peut pas lire les en-tetes de la
 * navigation qui l'a produit, mais il peut lire le cookie. Les appels `fetch`
 * lisent directement l'en-tete de leur propre reponse.
 */

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_COOKIE = "pb_req";

export function requestIdFromResponse(response: Response): string {
  return response.headers.get(REQUEST_ID_HEADER) ?? "";
}

export function formatRequestRef(requestId: string | null | undefined): string {
  return requestId ? ` (réf. req:${requestId})` : "";
}

/** Extrait `pb_req` d'une chaine `document.cookie`, sans dependre du DOM. */
export function requestIdFromCookie(cookieHeader: string): string {
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${REQUEST_ID_COOKIE}=`)) continue;
    return decodeURIComponent(trimmed.slice(REQUEST_ID_COOKIE.length + 1));
  }
  return "";
}
