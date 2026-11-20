// ============================================================
// Modele de contenu bilingue.
// Une seule forme pour les deux langues : chaque section recoit un
// LandingContent et ne connait pas la locale. Les pages / et /en
// choisissent l'objet, les composants ne changent pas.
// ============================================================

export type LandingLink = {
  href: string;
  label: string;
  external?: boolean;
};

export type LandingPhoto = {
  src: string;
  alt: string;
  caption: string;
  position?: string;
};

export type LandingBeat = {
  time: string;
  when: string;
  query: string;
  connections: readonly { kind: string; text: string }[];
  answer: string;
  nextStep: {
    label: string;
    text: string;
    confirm: string;
    dismiss: string;
    confirmed: string;
    dismissed: string;
  };
};

export type LandingContent = {
  locale: "fr" | "en";
  switchHref: string;
  switchLabel: string;
  githubUrl: string;
  selfHostUrl: string;
  roadmapUrl: string;
  installCommand: string;
  nav: readonly LandingLink[];
  hero: {
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    loginCta: string;
    note: string;
  };
  context: {
    label: string;
    title: string;
    lead: string;
    question: string;
    fragments: readonly { kind: string; text: string }[];
    answer: string;
    foot: string;
    sourcesCount: string;
  };
  modules: {
    title: string;
    lead: string;
    items: readonly { name: string; short: string; line: string }[];
  };
  memory: {
    factsLabel: string;
    facts: readonly { kind: string; text: string }[];
    title: string;
    lead: string;
    principles: readonly { title: string; desc: string }[];
    editable: string;
  };
  dayStory: {
    title: string;
    lead: string;
    disclaimer: string;
    beats: readonly LandingBeat[];
    outro: string;
  };
  publicDemo: {
    title: string;
    description: string;
    disclaimer: string;
    placeholder: string;
    button: string;
    suggestions: readonly string[];
    contextLabel: string;
    inputLabel: string;
    loading: string;
    errors: { rate: string; generic: string; invalid: string };
    after: {
      title: string;
      text: string;
      loginCta: string;
      githubCta: string;
      note: string;
    };
  };
  roadmap: {
    badge: string;
    title: string;
    lead: string;
    facts: readonly { title: string; desc: string }[];
    status: { label: string; value: string };
    roadmapCta: string;
    codeCta: string;
    note: string;
  };
  selfHost: {
    title: string;
    lead: string;
    facts: readonly { title: string; desc: string }[];
    terminalTitle: string;
    terminalNote: string;
    cta: string;
    codeCta: string;
  };
  photos: {
    credit: string;
    afterHero: LandingPhoto;
    afterStory: LandingPhoto;
    afterMemory: LandingPhoto;
    beforeClose: LandingPhoto;
  };
  finalCta: {
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    tertiaryCta: string;
    note: string;
  };
  footer: {
    tagline: string;
    links: readonly LandingLink[];
    legal: readonly LandingLink[];
    signature: string;
  };
  ui: {
    navLabel: string;
    mobileNavLabel: string;
    openMenu: string;
    closeMenu: string;
    footerLinksLabel: string;
    copyCommand: string;
    commandCopied: string;
    copy: string;
    copied: string;
    localData: string;
  };
};
