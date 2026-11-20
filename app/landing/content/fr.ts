// ============================================================
// Contenu francais : assemblage des sections en un LandingContent.
// Les pages importent FR_CONTENT (ou EN_CONTENT) et le passent aux
// composants, qui ne changent jamais selon la langue.
// ============================================================

import {
  GITHUB_URL,
  INSTALL_COMMAND,
  NAV_LINKS,
  ROADMAP_URL,
  SELF_HOST_URL,
} from "./constants";
import { CONTEXT, HERO } from "./hero";
import { MODULES } from "./modules";
import { MEMORY } from "./memory";
import { DAY_STORY } from "./day-story";
import { PUBLIC_DEMO } from "./public-demo";
import { ROADMAP } from "./roadmap";
import { SELF_HOST } from "./self-host";
import { PHOTOS } from "./photos";
import { FINAL_CTA, FOOTER } from "./final-cta";
import type { LandingContent } from "./types";

export const FR_CONTENT: LandingContent = {
  locale: "fr",
  switchHref: "/en",
  switchLabel: "EN",
  githubUrl: GITHUB_URL,
  selfHostUrl: SELF_HOST_URL,
  roadmapUrl: ROADMAP_URL,
  installCommand: INSTALL_COMMAND,
  nav: [...NAV_LINKS],
  hero: {
    title: HERO.title,
    description: HERO.description,
    primaryCta: HERO.primaryCta,
    secondaryCta: HERO.secondaryCta,
    loginCta: HERO.loginCta,
    note: HERO.note,
  },
  context: { ...CONTEXT, sourcesCount: "4 sources" },
  modules: MODULES,
  memory: { ...MEMORY, editable: "modifiable" },
  dayStory: DAY_STORY,
  publicDemo: {
    ...PUBLIC_DEMO,
    suggestions: [...PUBLIC_DEMO.suggestions],
    inputLabel: "Votre question pour la démonstration",
    loading: "Réponse en cours",
  },
  roadmap: ROADMAP,
  selfHost: SELF_HOST,
  photos: PHOTOS,
  finalCta: FINAL_CTA,
  footer: {
    tagline: FOOTER.tagline,
    links: FOOTER.links,
    legal: FOOTER.legal,
    signature: FOOTER.signature,
  },
  ui: {
    navLabel: "Navigation principale",
    mobileNavLabel: "Navigation mobile",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    footerLinksLabel: "Liens de pied de page",
    copyCommand: "Copier la commande d'installation",
    commandCopied: "Commande copiée",
    copy: "Copier",
    copied: "Copié",
    localData: "Données locales",
  },
};
