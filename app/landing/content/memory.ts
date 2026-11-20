// ============================================================
// Section memoire : faits retenus et principes.
// ============================================================

export const MEMORY = {
  factsLabel: "Mémoire · 3 faits",
  facts: [
    { kind: "Contact", text: "Claire V., attachée de presse — accréditations" },
    { kind: "Préférence", text: "Objectif lumineux privilégié en fosse" },
    { kind: "Projet", text: "Série « Scène 2025 », livraison en cours" },
  ],
  title: "Elle se souvient. Vous pouvez vérifier.",
  lead: "Une conversation ne s'arrête plus à sa dernière ligne. Les faits utiles sont écrits, dédoublonnés, puis relus : ce qui est retenu reste visible et corrigeable.",
  principles: [
    {
      title: "Se souvenir",
      desc: "Préférences, décisions, contacts : les éléments durables survivent à la conversation qui les a vus naître.",
    },
    {
      title: "Relier",
      desc: "Un fait sur une personne, une date ou un projet rejoint les autres. Une question sur un événement retrouve ce qui s'y rapporte.",
    },
    {
      title: "Garder le contrôle",
      desc: "La mémoire n'est pas une boîte noire : elle se lit, s'édite et se supprime depuis l'interface.",
    },
  ],
} as const;
