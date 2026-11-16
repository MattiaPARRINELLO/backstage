/**
 * Frontieres de dependance de BACKSTAGE.
 *
 * Chaque regle porte la raison pour laquelle elle existe, pas seulement ce
 * qu'elle interdit. Commande : `bun run boundaries`.
 *
 * La regle 5 de l'issue #85 (`process.env` interdit hors `lib/config.ts`) est
 * encodee par ESLint (`no-restricted-properties`, voir `eslint.config.mjs`) :
 * dependency-cruiser ne voit que les imports, pas les acces aux globales.
 * La regle 6 (`fetch` interdit hors port HTTP) est differee avec #89.
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
