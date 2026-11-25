import { describe, expect, it } from "vitest";

import { jsonDelayForKeys, parseGroqKeys, retryAfterMs } from "../groq";

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

describe("attente entre deux extractions", () => {
  it("n'attend pas sans compte Groq", () => {
    expect(jsonDelayForKeys(0)).toBe(0);
  });

  it("impose 6 s avec un seul compte", () => {
    expect(jsonDelayForKeys(1)).toBe(6000);
  });

  it("descend a 1,5 s des deux comptes", () => {
    expect(jsonDelayForKeys(2)).toBe(1500);
    expect(jsonDelayForKeys(4)).toBe(1500);
  });

  it("respecte la valeur explicite de GROQ_SCAN_DELAY_MS", () => {
    expect(jsonDelayForKeys(1, "250")).toBe(250);
    expect(jsonDelayForKeys(3, "0")).toBe(0);
  });

  it("ignore une valeur explicite illisible", () => {
    expect(jsonDelayForKeys(1, "vite")).toBe(6000);
    expect(jsonDelayForKeys(2, "-5")).toBe(1500);
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
