import { describe, it, expect } from "vitest";
import { hasNewInformation, normalizeFactText } from "@/lib/memory-dedup";

describe("normalizeFactText", () => {
  it("minuscule, sans accents, espaces normalises", () => {
    expect(normalizeFactText("  Est Photographe   LIVE & Concert ")).toBe(
      "est photographe live & concert"
    );
    expect(normalizeFactText("Média spécialisé à Nantes")).toBe("media specialise a nantes");
  });
});

describe("hasNewInformation — garde anti-perte du dedoublonnage", () => {
  it("une simple reformulation n'apporte rien de nouveau", () => {
    expect(hasNewInformation("Est photographe live & concert", "Est photographe live & concert")).toBe(
      false
    );
    expect(hasNewInformation("Utilise TypeScript au quotidien", "Utilise TypeScript")).toBe(false);
  });

  it("un nom propre absent du fait existant est une information nouvelle", () => {
    // Le cas reel : Rapstar n'a rien a voir avec « etre photographe ».
    expect(hasNewInformation("Travaille avec Rapstar, media rap", "Est photographe live & concert")).toBe(
      true
    );
  });

  it("un fait enrichi qui reprend le noyau existant n'est pas un doublon", () => {
    expect(
      hasNewInformation(
        "Photographe live & concert, collabore avec Rapstar (media rap, 21k abonnes)",
        "Est photographe live & concert"
      )
    ).toBe(true);
  });

  it("un chiffre ou un pourcentage suffit a distinguer", () => {
    expect(hasNewInformation("Rapstar compte 21k abonnes", "Rapstar est un media rap")).toBe(true);
  });

  it("une URL ou un pseudo suffit a distinguer", () => {
    expect(hasNewInformation("Son portfolio est photo.mprnl.fr", "A un portfolio photo")).toBe(true);
    expect(hasNewInformation("Compte @rapstar_france", "Suit des medias rap")).toBe(true);
  });

  it("une entite deja presente dans le fait existant ne cree pas de doublon", () => {
    expect(hasNewInformation("Rapstar est un media rap", "Travaille avec Rapstar")).toBe(false);
  });

  it("la majuscule du premier mot de phrase n'est pas un nom propre", () => {
    expect(hasNewInformation("Photographe de concert", "Est photographe de concert")).toBe(false);
  });

  it("un fait existant vide laisse toujours passer le candidat", () => {
    expect(hasNewInformation("N'importe quoi", "")).toBe(true);
  });

  it("un fait hors sujet n'est pas absorbe par le fait le plus proche", () => {
    // Le cas reel : « pas de carte de presse » a ete absorbe par un fait sur
    // Samuel / Bleu Citron, que le modele avait designe comme le plus proche.
    expect(
      hasNewInformation("Pas de carte de presse", "Samuel, photographe pour Bleu Citron")
    ).toBe(true);
    expect(hasNewInformation("Pas de carte de presse", "Travaille avec Rapstar")).toBe(true);
    expect(hasNewInformation("Dort mal en semaine", "Est photographe de concert")).toBe(true);
  });

  it("une negation face a une affirmation est une contradiction, pas un doublon", () => {
    expect(hasNewInformation("Pas de carte de presse", "A une carte de presse")).toBe(true);
    expect(hasNewInformation("Ne travaille jamais avec Bleu Citron", "Travaille avec Bleu Citron")).toBe(
      true
    );
    // Meme polarite : la reformulation reste un doublon.
    expect(hasNewInformation("N'a pas de carte de presse", "Pas de carte de presse")).toBe(false);
  });

  it("une reformulation de meme sujet reste un doublon", () => {
    expect(
      hasNewInformation("Photographie pour Bleu Citron", "Photographe pour Bleu Citron")
    ).toBe(false);
  });
});
