// ============================================================
// CONTENU EDITORIAL DE LA LANDING BACKSTAGE.
// Positionnement : un espace personnel qui relie les morceaux
// d'une journee et s'en souvient. Toutes les donnees de
// demonstration sont FICTIVES et signalees comme telles.
//
// Ce fichier est le point d'entree public : le contenu est reparti
// par section dans `app/landing/content/`. Modifier une section
// suffit pour changer les textes correspondants.
// ============================================================

export {
  GITHUB_URL,
  SELF_HOST_URL,
  ROADMAP_URL,
  LICENSE_LABEL,
  INSTALL_COMMAND,
  NAV_LINKS,
} from "./landing/content/constants";

export { HERO, CONTEXT } from "./landing/content/hero";
export { MODULES } from "./landing/content/modules";
export type { ModuleItem } from "./landing/content/modules";
export { MEMORY } from "./landing/content/memory";
export { DAY_STORY } from "./landing/content/day-story";
export { PUBLIC_DEMO } from "./landing/content/public-demo";
export { ROADMAP } from "./landing/content/roadmap";
export { SELF_HOST } from "./landing/content/self-host";
export { PHOTOS } from "./landing/content/photos";
export { FINAL_CTA, FOOTER } from "./landing/content/final-cta";

export type {
  LandingLink,
  LandingPhoto,
  LandingBeat,
  LandingContent,
} from "./landing/content/types";

export { FR_CONTENT } from "./landing/content/fr";
