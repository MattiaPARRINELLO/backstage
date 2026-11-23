import { describe, expect, it } from "vitest";

import { parseGroqKeys } from "../groq";

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
