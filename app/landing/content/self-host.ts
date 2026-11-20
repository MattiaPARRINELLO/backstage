// ============================================================
// Section auto-hebergement : faits et bloc terminal.
// ============================================================

export const SELF_HOST = {
  title: "Chez vous, en une commande.",
  lead: "Backstage tourne sur votre machine : un dossier de données, un conteneur, aucune dépendance à un service tiers pour exister.",
  facts: [
    {
      title: "Accès par passkey",
      desc: "Pas de mot de passe à retenir : l'entrée est biométrique, et toute route privée est protégée par défaut.",
    },
    {
      title: "Données locales",
      desc: "L'espace vit dans des fichiers JSON, chez vous, avec sauvegardes et écritures atomiques.",
    },
    {
      title: "Actions confirmées",
      desc: "Un mail envoyé, un agenda modifié : rien ne part sans une confirmation explicite.",
    },
    {
      title: "Licence MIT",
      desc: "Le code est public : lisez-le, auditez-le, déployez votre propre instance.",
    },
  ],
  terminalTitle: "Installation",
  terminalNote: "Node 22 et Docker · ou clonez le dépôt et lancez le guide d'auto-hébergement.",
  cta: "Guide d'auto-hébergement",
  codeCta: "Voir le code sur GitHub",
} as const;
