/**
 * Double de test du port HTTP (issue #89), injecte via `withHttpDouble` : aucun
 * test ne remplace `globalThis.fetch`. Les tests s'executent en serie.
 */
import { withHttpFetch, type FetchLike } from "@/lib/http";

export type HttpDoubleResponse =
  | Response
  | ((url: string, init: RequestInit) => Response | Promise<Response>);

export interface HttpDoubleRoute {
  readonly match: string | RegExp | ((url: string, init: RequestInit) => boolean);
  readonly response: HttpDoubleResponse;
}

export interface HttpDoubleCall { readonly url: string; readonly init: RequestInit }
export interface HttpDouble { readonly fetch: FetchLike; readonly calls: HttpDoubleCall[] }

function matches(match: HttpDoubleRoute["match"], url: string, init: RequestInit): boolean {
  if (typeof match === "string") return match === url;
  if (match instanceof RegExp) return match.test(url);
  return match(url, init);
}

export function createHttpDouble(routes: readonly HttpDoubleRoute[]): HttpDouble {
  const calls: HttpDoubleCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    const requestInit = init ?? {};
    calls.push({ url, init: requestInit });

    const route = routes.find((candidate) => matches(candidate.match, url, requestInit));
    if (!route) throw new Error(`[http-double] aucune route pour ${url}`);
    if (typeof route.response === "function") return route.response(url, requestInit);
    // Un Response statique ne se lit qu'une fois : on le clone pour le retry.
    return route.response.clone();
  };
  return { fetch, calls };
}

/** Execute `fn` avec les routes donnees, sans toucher au `fetch` global. */
export function withHttpDouble<T>(
  routes: readonly HttpDoubleRoute[],
  fn: (double: HttpDouble) => Promise<T>
): Promise<T> {
  const double = createHttpDouble(routes);
  return withHttpFetch(double.fetch, () => fn(double));
}

/** Reponse JSON prete a l'emploi. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}
