// ============================================================
// Premier ecran et contexte relie.
// ============================================================

export const HERO = {
  title: "Votre contexte, en un seul endroit.",
  description:
    "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient. Un espace privé, installé chez vous.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Voir le code",
  loginCta: "Se connecter",
  note: "Démonstration publique à données fictives · Comptes publics en préparation",
  shot: {
    src: "/screenshots/hero-flux.jpg",
    alt: "L'application Backstage ouverte sur le chat, avec à droite le panneau de flux : cours du lendemain, rappels en retard et mails non lus.",
    caption: "Le chat au centre, le flux de la journée à droite.",
  },
} as const;

export const CONTEXT = {
  label: "Contexte relié",
  title: "Une question. Quatre morceaux s'assemblent.",
  lead: "Backstage ne fouille pas un seul dossier : il réunit ce que l'agenda, la boîte mail, les notes et les rappels savent déjà, puis il répond.",
  question: "Qu'est-ce que je dois préparer pour mon shooting de demain ?",
  fragments: [
    { kind: "Agenda", text: "Shooting jeudi 20:30, Le Transbordeur" },
    { kind: "Mail", text: "Claire V. : accréditation au nom du média, à retirer sur place" },
    { kind: "Note", text: "Fosse : 3 titres, puis côté scène" },
    { kind: "Rappel", text: "Charger batteries et cartes CF ce soir" },
  ],
  answer:
    "Jeudi 20:30 au Transbordeur. L'accréditation est au nom du média, à retirer sur place ; accès fosse sur les 3 premiers titres, puis côté scène. Batteries et cartes CF à charger ce soir.",
  foot: "Quatre éléments de l'espace réunis en une réponse · exemple fictif",
} as const;
