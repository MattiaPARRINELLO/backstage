import { describe, expect, it } from "vitest";

import type { GmailThread } from "@backstage/module-kit";
import {
  buildBatchPrompt,
  chunk,
  extractThreads,
  parseBatch,
  parseSingle,
  stripQuoted,
  type ExtractionAi,
} from "../extraction";

function thread(id: string, body: string, fromMe = false): GmailThread {
  return {
    id,
    messages: [
      {
        id: `${id}-m1`,
        threadId: id,
        from: fromMe ? "Rapstar <contact@rapstar.fr>" : "Salle <presse@salle.fr>",
        subject: "Demande de photos",
        date: "Tue, 10 Nov 2026 12:00:00 +0000",
        snippet: body,
        body,
        unread: false,
        fromMe,
      },
    ],
  };
}

describe("nettoyage du corps d'un email", () => {
  it("coupe l'historique cite sous l'entete de reponse", () => {
    const body = [
      "Oui, c'est bon pour vendredi.",
      "",
      "Le 10 nov. 2026, a 10:00, Rapstar <contact@rapstar.fr> a ecrit :",
      "> Bonjour, je souhaite couvrir le concert de Muse.",
    ].join("\n");

    expect(stripQuoted(body)).toBe("Oui, c'est bon pour vendredi.");
  });

  it("coupe aussi une citation anglaise et les lignes >", () => {
    expect(stripQuoted("Sure, see you there.\nOn Mon, Nov 9, 2026 Bob wrote:\n> hi")).toBe(
      "Sure, see you there."
    );
    expect(stripQuoted("Merci\n> ancien message")).toBe("Merci");
  });

  it("garde le texte quand il n'y a rien a couper", () => {
    expect(stripQuoted("Concert de Muse au Zenith le 20 novembre.")).toBe(
      "Concert de Muse au Zenith le 20 novembre."
    );
  });
});

describe("lecture des reponses IA", () => {
  it("lit un objet de lot et ignore un id inconnu", () => {
    const raw = JSON.stringify({
      results: [
        { id: "t1", artist: "Muse", venue: "Zenith", concertDate: "2026-11-20" },
        { id: "absent", artist: "Fantome" },
      ],
    });

    const parsed = parseBatch(raw, [thread("t1", "texte")]);

    expect(parsed.size).toBe(1);
    expect(parsed.get("t1")).toMatchObject({ artist: "Muse", status: "pending" });
  });

  it("accepte un tableau direct", () => {
    const raw = JSON.stringify([{ id: "t1", artist: "Muse" }]);
    expect(parseBatch(raw, [thread("t1", "texte")]).get("t1")?.artist).toBe("Muse");
  });

  it("rend une map vide sur une reponse illisible", () => {
    expect(parseBatch("desole", [thread("t1", "texte")]).size).toBe(0);
    expect(parseSingle("desole")).toBeNull();
  });
});

describe("extraction des fils", () => {
  it("replie fil par fil quand le lot est illisible", async () => {
    const calls: string[] = [];
    const ai: ExtractionAi = {
      json: async ({ prompt }) => {
        calls.push(prompt);
        if (calls.length === 1) return "je ne peux pas";
        return JSON.stringify({ artist: "Muse", venue: "Zenith" });
      },
      complete: async () => "",
    };

    const found = await extractThreads(ai, [
      thread("t1", "Concert de Muse au Zenith"),
      thread("t2", "Concert de Muse au Zenith"),
    ]);

    expect(calls).toHaveLength(3);
    expect(found.get("t1")?.artist).toBe("Muse");
    expect(found.get("t2")?.artist).toBe("Muse");
  });

  it("marque l'auteur utilisateur dans le prompt du lot", () => {
    const prompt = buildBatchPrompt([thread("t1", "Je demande un pass", true)]);
    expect(prompt).toContain("### Fil t1");
    expect(prompt).toContain("(vous)");
  });
});

describe("decoupage en lots", () => {
  it("garde tous les elements, dans l'ordre", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
