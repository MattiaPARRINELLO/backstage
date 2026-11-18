import { defineModule } from "@backstage/module-kit";

import { pageMetaTool, webSearchTool } from "./tools";

/**
 * Module Recherche web.
 *
 * Sixieme module migre. La garde anti-SSRF et les clients Brave /
 * DuckDuckGo restent dans le noyau (`lib/web.ts`) ; le module expose deux
 * lectures non fiables, sans ecriture.
 */
export default defineModule({
  id: "web",
  apiVersion: 1,
  version: "1.0.0",
  label: "Recherche web",
  selectionDescription: "Rechercher sur le web et lire les métadonnées d'une page.",
  description:
    "Recherche Brave avec repli DuckDuckGo, et titre/miniature d'une page web ou d'une vidéo YouTube.",
  dependencies: [],
  capabilities: { network: ["api.search.brave.com", "api.duckduckgo.com"] },
  tools: [webSearchTool, pageMetaTool],
});
