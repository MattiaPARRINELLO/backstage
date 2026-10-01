import { describe, expect, it } from "vitest";
import { clampText, lineCount, stripEmoji } from "@/lib/discord/text";

describe("stripEmoji", () => {
  it("retire les emojis que les polices embarquées ne savent pas dessiner", () => {
    expect(stripEmoji("Rappel ⏰ urgent 🔥")).toBe("Rappel urgent");
  });

  it("retire les sélecteurs de variation et les liants", () => {
    expect(stripEmoji("famille 👨‍👩‍👧 ici")).toBe("famille ici");
  });

  it("laisse intactes les lettres accentuées", () => {
    expect(stripEmoji("Réunion à l'École — 15 °C")).toBe("Réunion à l'École — 15 °C");
  });
});

describe("clampText", () => {
  it("replie les sauts de ligne", () => {
    expect(clampText("un\n  deux", 40)).toBe("un deux");
  });

  it("tronque avec une ellipse sans dépasser la limite", () => {
    const out = clampText("x".repeat(80), 20);
    expect(out).toHaveLength(20);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("lineCount", () => {
  it("compte au moins une ligne pour un texte vide", () => {
    expect(lineCount("", 50)).toBe(1);
  });

  it("passe à deux lignes quand le texte dépasse la largeur utile", () => {
    // 1100 - 2 * 44 = 1012 px utiles ; à 50 px, ~38 caractères par ligne.
    expect(lineCount("a".repeat(30), 50)).toBe(1);
    expect(lineCount("a".repeat(50), 50)).toBe(2);
  });

  it("accepte une largeur de colonne réduite", () => {
    expect(lineCount("a".repeat(40), 24, 300)).toBeGreaterThan(1);
  });
});
