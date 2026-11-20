// ============================================================
// Comptes et cles (chantier en cours).
// Annonce honnete du passage au multi-utilisateur : pas de promesse
// de disponibilite, capacite gratuite limitee, branche de
// developpement nommee.
// ============================================================

export const ROADMAP = {
  badge: "Chantier en cours",
  title: "Comptes, clés, espace personnel.",
  lead: "Backstage prépare son ouverture : un socle commun (chat, mémoire, rappels, agenda, mails), des modules que chacun active selon ses besoins, et ses propres clés API. Le travail est en cours sur une branche dédiée, rien de tout cela n'est encore accessible.",
  facts: [
    {
      title: "Compte personnel",
      desc: "Inscription par passkey et code de secours. Un espace vide au départ, isolé de tous les autres comptes.",
    },
    {
      title: "Vos clés, votre coût",
      desc: "IA, Google, Microsoft, météo, recherche : vous branchez ce que vous voulez avec vos propres clés. Aucune clé partagée entre comptes.",
    },
    {
      title: "Socle et modules",
      desc: "Le socle est identique pour tous. Photos, concerts, LeetCode et les autres modules s'activent au cas par cas, à la demande et selon les retours.",
    },
    {
      title: "Gratuit et limité",
      desc: "L'accès restera gratuit pendant la phase de test, avec une capacité de 10 à 15 comptes. Ce n'est pas un service illimité.",
    },
  ],
  status: {
    label: "Branche",
    value: "feat/multi-utilisateurs-byok",
  },
  roadmapCta: "Lire la roadmap",
  codeCta: "Voir le code",
  note: "Pas encore disponible : inscription ouverte, récupération de compte, quotas, facturation. La démo publique reste la seule entrée sans compte.",
} as const;
