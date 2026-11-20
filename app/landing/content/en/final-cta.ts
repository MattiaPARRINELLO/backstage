// ============================================================
// Appel a l'action final et pied de page (version anglaise).
// ============================================================

import { GITHUB_URL, SELF_HOST_URL } from "./constants";

export const FINAL_CTA = {
  title: "What if your day finally formed a whole?",
  description:
    "The public preview is enough to see how Backstage connects a question to its context.",
  primaryCta: "Try the demo",
  secondaryCta: "Sign in",
  tertiaryCta: "View the code",
  note: "Demo with fictional data · Public accounts in preparation",
} as const;

export const FOOTER = {
  tagline: "A personal space that understands context.",
  links: [
    { href: "#hero", label: "Product" },
    { href: "#memoire", label: "Memory" },
    { href: "#journee", label: "A day" },
    { href: "#chez-vous", label: "Self-hosting" },
  ],
  legal: [
    { href: GITHUB_URL, label: "GitHub", external: true },
    { href: SELF_HOST_URL, label: "Documentation", external: true },
    { href: "/privacy", label: "Privacy", external: false },
    { href: "/login", label: "Sign in", external: false },
  ],
  signature: "MIT licence · Public source code · Built with OpenCode",
} as const;
