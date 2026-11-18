import { defineModule } from "@backstage/module-kit";

import { createGithubIssueTool, listGithubIssuesTool } from "./tools";

/**
 * Module GitHub.
 *
 * Cinquieme module migre. Le depot est fige par `GITHUB_REPO` : aucun argument
 * d'outil ne peut changer la cible. La creation reste immediate (comportement
 * historique) ; seule une provenance contaminee la met en attente.
 */
export default defineModule({
  id: "github",
  apiVersion: 1,
  version: "1.0.0",
  label: "GitHub",
  selectionDescription: "Issues du dépôt Backstage : lister, créer.",
  description:
    "Liste et création d'issues sur le dépôt GitHub fixé par GITHUB_REPO, avec libellés restreints.",
  dependencies: [],
  capabilities: { network: ["api.github.com"], env: ["GITHUB_TOKEN", "GITHUB_REPO"] },
  tools: [createGithubIssueTool, listGithubIssuesTool],
});
