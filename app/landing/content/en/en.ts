// ============================================================
// Contenu anglais : assemblage des sections en un LandingContent.
// Miroir de FR_CONTENT. Le contexte de demonstration et les textes
// produit restent fictifs ; l'application elle-meme est encore en
// francais, ce que la section roadmap dit clairement.
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
import type { LandingContent } from "../types";

export const EN_CONTENT: LandingContent = {
  locale: "en",
  switchHref: "/",
  switchLabel: "FR",
  githubUrl: GITHUB_URL,
  selfHostUrl: SELF_HOST_URL,
  roadmapUrl: ROADMAP_URL,
  installCommand: INSTALL_COMMAND,
  nav: [...NAV_LINKS],
  hero: HERO,
  context: CONTEXT,
  modules: MODULES,
  memory: MEMORY,
  dayStory: DAY_STORY,
  publicDemo: PUBLIC_DEMO,
  roadmap: ROADMAP,
  selfHost: SELF_HOST,
  photos: PHOTOS,
  finalCta: FINAL_CTA,
  footer: FOOTER,
  ui: {
    navLabel: "Main navigation",
    mobileNavLabel: "Mobile navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    footerLinksLabel: "Footer links",
    copyCommand: "Copy the install command",
    commandCopied: "Command copied",
    copy: "Copy",
    copied: "Copied",
    localData: "Local data",
  },
};
