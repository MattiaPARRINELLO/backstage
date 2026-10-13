import { describe, it, expect } from "vitest";
import {
  classifyToolText,
  renderToolText,
  parseToolText,
  isFailedStatus,
  TOOL_STATUS_MARKER,
  TOOL_HONESTY_RULE,
} from "@/lib/tool-result";

describe("classifyToolText", () => {
  it("classe les succès en ok", () => {
    expect(classifyToolText("Rappel cree : \"Choix\" pour le 12/10/2026.")).toBe("ok");
    expect(classifyToolText("- [r1] \"Cours\" -> 12/10/2026 (pending)")).toBe("ok");
  });

  it("détecte un blocage par son préfixe, avant toute autre règle", () => {
    expect(classifyToolText("ACTION_BLOCKED:send_email_response ...")).toBe("blocked");
  });

  it("classe les échecs meme quand le texte ne commence pas par « Erreur »", () => {
    expect(classifyToolText("Erreur : titre requis.")).toBe("error");
    expect(classifyToolText("Rappel introuvable.")).toBe("error");
    expect(classifyToolText("Ville \"Paris\" introuvable.")).toBe("error");
    expect(classifyToolText("Emploi du temps inconnu (aucun sync CESAR effectue).")).toBe("error");
    expect(classifyToolText("Erreur API météo (401).")).toBe("error");
    expect(classifyToolText("Erreur : ecriture non confirmee ...")).toBe("error");
  });

  it("distingue un résultat vide (source vivante, aucun élément)", () => {
    expect(classifyToolText("Aucun rappel pour le moment.")).toBe("empty");
    expect(classifyToolText("Pas de cours demain.")).toBe("empty");
    expect(classifyToolText("")).toBe("empty");
  });
});

describe("renderToolText / parseToolText", () => {
  it("préfixe le statut et sait le relire", () => {
    const rendered = renderToolText("error", "Rappel introuvable.");
    expect(rendered).toBe("[ERREUR] Rappel introuvable.");
    expect(parseToolText(rendered)).toEqual({ status: "error", text: "Rappel introuvable." });
  });

  it("relit un texte sans marqueur en le classant", () => {
    expect(parseToolText("Erreur: boom")).toEqual({ status: "error", text: "Erreur: boom" });
    expect(parseToolText("Rappel cree.").status).toBe("ok");
  });

  it("couvre les quatre marqueurs", () => {
    expect(Object.values(TOOL_STATUS_MARKER).sort()).toEqual(["BLOQUE", "ERREUR", "OK", "VIDE"]);
    for (const status of ["ok", "error", "empty", "blocked"] as const) {
      expect(parseToolText(renderToolText(status, "x")).status).toBe(status);
    }
  });
});

describe("isFailedStatus", () => {
  it("interdit de prétendre que l'action a eu lieu", () => {
    expect(isFailedStatus("ok")).toBe(false);
    expect(isFailedStatus("empty")).toBe(false);
    expect(isFailedStatus("error")).toBe(true);
    expect(isFailedStatus("blocked")).toBe(true);
  });
});

describe("TOOL_HONESTY_RULE", () => {
  it("nomme les quatre statuts", () => {
    for (const marker of Object.values(TOOL_STATUS_MARKER)) {
      expect(TOOL_HONESTY_RULE).toContain(`[${marker}]`);
    }
  });
});
