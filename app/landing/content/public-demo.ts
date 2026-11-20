// ============================================================
// Mini-demo publique et messages d'erreur associes.
// ============================================================

export const PUBLIC_DEMO = {
  title: "Posez votre question.",
  description:
    "La démonstration répond à partir d'un jeu de données fictives, comme l'application le ferait avec les vôtres.",
  disclaimer: "Démonstration limitée, données fictives. Aucun accès à votre espace personnel.",
  placeholder: "Ex. : Que dois-je préparer pour demain ?",
  button: "Demander",
  suggestions: [
    "Que dois-je préparer pour demain ?",
    "Retrouve les informations de mon prochain shooting.",
    "Quels événements importants arrivent bientôt ?",
  ],
  contextLabel: "Contexte mobilisé (fictif)",
  errors: {
    rate: "Trop de demandes, réessayez dans un instant.",
    generic: "La démonstration est momentanément indisponible. Réessayez.",
    invalid: "Question trop longue (400 caractères maximum).",
  },
  after: {
    title: "Ceci n'était qu'un aperçu.",
    text: "L'application complète est réservée aux personnes disposant déjà d'un accès.",
    loginCta: "Se connecter",
    githubCta: "Voir le code",
    note: "Les comptes publics sont en développement : voir la section « Comptes ».",
  },
} as const;
