import { describe, expect, it } from "vitest";

import { parseGroqKeys, retryAfterMs } from "../groq";

describe("pool de cles Groq", () => {
  it("decoupe virgules, espaces et points-virgules", () => {
    expect(parseGroqKeys("gsk_a, gsk_b\n gsk_c;gsk_d")).toEqual([
      "gsk_a",
      "gsk_b",
      "gsk_c",
      "gsk_d",
    ]);
  });

  it("deduit les doublons et ignore les vides", () => {
    expect(parseGroqKeys(" gsk_a ,, gsk_a ,  ")).toEqual(["gsk_a"]);
  });

  it("rend une liste vide sans valeur", () => {
    expect(parseGroqKeys(undefined)).toEqual([]);
    expect(parseGroqKeys("   ")).toEqual([]);
  });
});

describe("attente apres un 429 Groq", () => {
  it("lit retry-after dans les en-tetes de l'erreur", () => {
    const error = { status: 429, headers: new Headers({ "retry-after": "7" }) };
    expect(retryAfterMs(error)).toBe(7000);
  });

  it("accepte un objet d'en-tetes simple", () => {
    expect(retryAfterMs({ status: 429, headers: { "retry-after": "2" } })).toBe(2000);
  });

  it("borne l'attente pour ne pas figer le scan", () => {
    expect(
      retryAfterMs({ status: 429, headers: new Headers({ "retry-after": "120" }) })
    ).toBe(20_000);
  });

  it("ne rend rien sans en-tete exploitable", () => {
    expect(retryAfterMs({ status: 500 })).toBeNull();
    expect(retryAfterMs({ status: 429, headers: new Headers() })).toBeNull();
    expect(
      retryAfterMs({ status: 429, headers: new Headers({ "retry-after": "bientot" }) })
    ).toBeNull();
  });
});
