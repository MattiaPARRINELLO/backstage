// ============================================================
// Appel a l'action final et pied de page.
// ============================================================

import { GITHUB_URL, SELF_HOST_URL } from "./constants";

export const FINAL_CTA = {
  title: "Et si votre journée formait enfin un tout ?",
  description:
    "L'aperçu public suffit pour voir comment Backstage relie une question à son contexte.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Se connecter",
  tertiaryCta: "Voir le code",
  note: "Démonstration à données fictives · Comptes publics en préparation",
} as const;

export const FOOTER = {
  tagline: "Un espace personnel qui comprend le contexte.",
  links: [
    { href: "#hero", label: "Produit" },
    { href: "#memoire", label: "Mémoire" },
    { href: "#journee", label: "Une journée" },
    { href: "#chez-vous", label: "Auto-hébergement" },
  ],
  legal: [
    { href: GITHUB_URL, label: "GitHub", external: true },
    { href: SELF_HOST_URL, label: "Documentation", external: true },
    { href: "/privacy", label: "Confidentialité", external: false },
    { href: "/login", label: "Se connecter", external: false },
  ],
  signature: "Licence MIT · Code source public · Développé avec OpenCode",
} as const;
