import { describe, it, expect } from "vitest";
import {
  formatQuotedMessage,
  parseQuotedMessage,
  type MessageQuote,
} from "@/components/chat/chat-data";

const quote = (text: string, comment: string): MessageQuote => ({
  id: "q1",
  text,
  comment,
});

describe("formatQuotedMessage", () => {
  it("laisse un message ordinaire intact", () => {
    expect(formatQuotedMessage([], "Salut")).toBe("Salut");
  });

  it("cite le texte et ajoute le commentaire", () => {
    const res = formatQuotedMessage([quote("Concert le 12 juin", "Je préfère le 13")], "");
    expect(res).toBe("> Concert le 12 juin\n\nCommentaire : Je préfère le 13");
  });

  it("gère plusieurs extraits et le texte libre", () => {
    const res = formatQuotedMessage(
      [quote("Info A", "D'accord"), quote("Info B", "Pas d'accord")],
      "Et sinon ?"
    );
    expect(res).toContain("> Info A");
    expect(res).toContain("Commentaire : D'accord");
    expect(res).toContain("> Info B");
    expect(res.endsWith("Et sinon ?")).toBe(true);
  });

  it("préfixe chaque ligne d'une citation multiligne", () => {
    const res = formatQuotedMessage([quote("Ligne 1\nLigne 2", "Ok")], "");
    expect(res.startsWith("> Ligne 1\n> Ligne 2\n\nCommentaire : Ok")).toBe(true);
  });
});

describe("parseQuotedMessage", () => {
  it("retourne le contenu brut sans citation", () => {
    expect(parseQuotedMessage("Juste un message")).toEqual({
      quotes: [],
      body: "Juste un message",
    });
  });

  it("relit ce que formatQuotedMessage a produit", () => {
    const content = formatQuotedMessage(
      [quote("Ligne 1\nLigne 2", "Mon avis"), quote("Autre info", "")],
      "Texte libre"
    );
    const parsed = parseQuotedMessage(content);
    expect(parsed.quotes).toEqual([
      { text: "Ligne 1\nLigne 2", comment: "Mon avis" },
      { text: "Autre info", comment: "" },
    ]);
    expect(parsed.body).toBe("Texte libre");
  });

  it("ne confond pas un texte commençant par un chevron avec une citation", () => {
    expect(parseQuotedMessage("> 5 = plus grand que 3")).toEqual({
      quotes: [],
      body: "> 5 = plus grand que 3",
    });
  });
});
