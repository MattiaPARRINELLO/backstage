/**
 * Frontieres de dependance de BACKSTAGE.
 *
 * Chaque regle porte la raison pour laquelle elle existe, pas seulement ce
 * qu'elle interdit. Commande : `bun run boundaries`.
 *
 * Les regles 5 et 6 de l'issue #85 (`process.env` hors `lib/config.ts`,
 * `fetch` hors port HTTP) sont encodees par ESLint (`no-restricted-*`, voir
 * `eslint.config.mjs`) : dependency-cruiser ne voit que les imports, pas les
 * acces aux globales.
 */
module.exports = {
  forbidden: [
    {
      name: "pas-de-cycle",
      comment:
        "Un cycle d'import rend le chargement dependant de l'ordre et casse le decoupage en modules : il n'y a jamais de bonne raison d'en garder un.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "storage-sans-react-ni-next",
      comment:
        "lib/storage persiste des donnees : il doit rester utilisable par un script cron, sans React ni requete HTTP (c'est ce qui permet de le tester et de l'executer hors Next).",
      severity: "error",
      from: { path: "^lib/storage/" },
      to: {
        path: "(^|/)node_modules/(react|react-dom|next)(/|$)|^components/",
      },
    },
    {
      name: "storage-sans-composant",
      comment:
        "Un store qui importe un composant inverse la direction des dependances : l'interface depend des donnees, jamais l'inverse.",
      severity: "error",
      from: { path: "^lib/storage/" },
      to: { path: "^components/" },
    },
    {
      name: "composants-sans-couche-serveur",
      comment:
        "Un composant tourne dans le navigateur : importer fs, next/headers ou un module serveur embarque du code Node dans le bundle client et casse le rendu.",
      severity: "error",
      from: { path: "^components/" },
      to: {
        path: "^(node:)?(fs|path|os|crypto)$|^next/headers$|(^|/)node_modules/next/headers|^lib/(storage|storage-core|session-core|send-push|cesar-client|google-client|microsoft-client|github-actions|daily-brief|notification-scheduler|config)$",
      },
    },
    {
      name: "modules-isoles",
      comment:
        "Un module ne connait aucun autre module : ils communiquent par les evenements du noyau. Sans cette regle, deux modules branches se couplent en silence (#84).",
      severity: "error",
      from: { path: "^modules/([^/]+)/" },
      to: { path: "^modules/", pathNot: "^modules/$1/" },
    },
    {
      name: "app-limite-aux-manifestes",
      comment:
        "app/ ne voit d'un module que son manifeste public : importer ses fichiers internes rend le module indeplacable et non distribuable (#84).",
      severity: "error",
      from: { path: "^app/" },
      to: { path: "^modules/[^/]+/(?!index\\.ts$)" },
    },
    {
      name: "kit-sans-noyau",
      comment:
        "Le kit de modules est le contrat, pas une extension du noyau : s'il importe lib/ ou app/, un module installe ailleurs ne peut plus le resoudre et le contrat se met a dependre de l'application entiere (#84).",
      severity: "error",
      from: { path: "^packages/module-kit/" },
      to: { path: "^(lib|app|components)/" },
    },
    {
      name: "modules-sans-noyau",
      comment:
        "Un module distribue s'installe ailleurs que dans ce depot : importer lib/ le rend inseparable du noyau. Il consomme une capacite du kit (ctx.ai, ctx.net, ctx.notify, ctx.mail, ctx.activity). La liste d'exceptions ne doit que decroitre ; chaque module restant a son issue de migration (#255) :\n" +
        "  - calendar : actions Google Agenda (#255)\n" +
        "  - concerts : types et stockage du noyau (#255)\n" +
        "  - daily-brief : job et stockage du noyau (#255)\n" +
        "  - emails : actions Gmail du noyau (#255)\n" +
        "  - followups : types et stockage du noyau (#255)\n" +
        "  - github : client GitHub du noyau (#255)\n" +
        "  - photo : types et stockage du noyau (#255)\n" +
        "  - reminders : types, stockage et notifications (#255)\n" +
        "  - schedule : client CESAR du noyau (#255)\n" +
        "  - weather : client meteo du noyau (#255)\n" +
        "  - web : client reseau du noyau (#255)",
      severity: "error",
      from: {
        path: "^modules/",
        pathNot:
          "^modules/(calendar|concerts|daily-brief|emails|followups|github|photo|reminders|schedule|weather|web)/",
      },
      to: { path: "^(lib|app|components)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.next|\\.test\\.ts$|__tests__|/e2e/|/android/|/scripts/)" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "default"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
