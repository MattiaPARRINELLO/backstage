import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Le kit n'est pas publie sur npm : les tests pointent vers le checkout du
 * depot noyau. Layout par defaut : ce depot et `backstage/` sont voisins.
 * Ailleurs, definir `BACKSTAGE_KIT=/chemin/vers/backstage/packages/module-kit/src`.
 */
const kitSrc =
  process.env.BACKSTAGE_KIT ??
  path.resolve(process.cwd(), "..", "backstage", "packages", "module-kit", "src");

const alias = [
  { find: /^@backstage\/module-kit$/, replacement: path.join(kitSrc, "index.ts") },
  { find: /^@backstage\/module-kit\/testing$/, replacement: path.join(kitSrc, "testing.ts") },
  { find: /^@backstage\/module-kit\/json-store$/, replacement: path.join(kitSrc, "json-store.ts") },
  { find: /^@backstage\/module-kit\/storage-core$/, replacement: path.join(kitSrc, "storage-core.ts") },
];

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: { alias },
});
