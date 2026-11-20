import { describe, expect, it } from "vitest";

import {
  formatRequestRef,
  requestIdFromCookie,
  requestIdFromResponse,
} from "@/lib/request-ref";

describe("reference de requete", () => {
  it("lit l'en-tete de reponse pose par le proxy", () => {
    const response = new Response(null, { headers: { "x-request-id": "abc12345" } });
    expect(requestIdFromResponse(response)).toBe("abc12345");
  });

  it("retourne une chaine vide si l'en-tete manque", () => {
    expect(requestIdFromResponse(new Response(null))).toBe("");
  });

  it("formate la reference pour un message utilisateur", () => {
    expect(formatRequestRef("abc12345")).toBe(" (réf. req:abc12345)");
    expect(formatRequestRef("")).toBe("");
    expect(formatRequestRef(undefined)).toBe("");
  });

  it("extrait pb_req du cookie sans confondre les autres cookies", () => {
    expect(requestIdFromCookie("pb_session=secret; pb_req=abc12345; autre=1")).toBe("abc12345");
    expect(requestIdFromCookie("pb_req=abc%20123")).toBe("abc 123");
    expect(requestIdFromCookie("pb_session=secret")).toBe("");
    expect(requestIdFromCookie("")).toBe("");
  });
});
