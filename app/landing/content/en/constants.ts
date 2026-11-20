// ============================================================
// Constantes partagees du contenu anglais de la landing.
// Les URL publiques ne dependent pas de la langue : elles sont
// reprises du contenu francais. Seuls les libelles changent.
// ============================================================

export { GITHUB_URL, ROADMAP_URL, SELF_HOST_URL } from "../constants";

/** Commande d'installation en une ligne, servie par /install.sh. */
export const INSTALL_COMMAND =
  "curl -fsSL https://backstage.mprnl.fr/install.sh | bash";

export const NAV_LINKS = [
  { href: "#hero", label: "Product" },
  { href: "#memoire", label: "Memory" },
  { href: "#journee", label: "A day" },
  { href: "#demo", label: "Demo" },
  { href: "#comptes", label: "Accounts" },
  { href: "#chez-vous", label: "Self-hosting" },
] as const;
