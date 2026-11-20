// ============================================================
// Constantes partagees du contenu de la landing.
// Les URL publiques et la commande d'installation servie par
// /install.sh. Chaque section les reutilise sans les redefinir.
// ============================================================

import { SITE_URL } from "@/lib/site-url";

export const GITHUB_URL = "https://github.com/MattiaPARRINELLO/backstage";
/** Guide d'auto-hebergement (licence MIT, Docker, variables, backups). */
export const SELF_HOST_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/main/docs/self-hosting.md";
/** Roadmap multi-utilisateurs et BYOK, sur la branche de developpement. */
export const ROADMAP_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/feat/multi-utilisateurs-byok/docs/roadmap-multi-utilisateurs.md";
export const LICENSE_LABEL = "MIT";
/** Commande d'installation en une ligne, servie par /install.sh. */
export const INSTALL_COMMAND = `curl -fsSL ${SITE_URL}/install.sh | bash`;

export const NAV_LINKS = [
  { href: "#hero", label: "Produit" },
  { href: "#memoire", label: "Mémoire" },
  { href: "#journee", label: "Une journée" },
  { href: "#demo", label: "Démo" },
  { href: "#comptes", label: "Comptes" },
  { href: "#chez-vous", label: "Auto-hébergement" },
] as const;
