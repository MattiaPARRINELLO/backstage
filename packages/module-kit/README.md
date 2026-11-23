# @backstage/module-kit

Contrat entre le noyau BACKSTAGE et un module. Un module importe ce paquet,
jamais l'interieur du noyau.

## Surface

| Sous-chemin | Contenu |
| --- | --- |
| `@backstage/module-kit` | `defineModule`, `defineTool`, `defineAction`, `ToolOutput` (`toolOk`, `toolError`, `toolEmpty`), `verifyWrite`, politique derivee (`requiresConfirmation`, `isConfirmable`, `isUntrusted`), primitives d'interface, `railIcon`, `useModuleAction` |
| `@backstage/module-kit/json-store` | `jsonStore` : fichier namespacce dans `data/<id>/`, validation Zod, ecriture atomique, `legacyPath` |
| `@backstage/module-kit/storage-core` | moteur de stockage bas niveau (`readJsonSafe`, `writeJsonAtomic`, `mutateJson`, `readOrCreate`) |
| `@backstage/module-kit/testing` | contrat de test : `createTestContext`, `runTool`, assertions `ok`/`error`/`empty`, `expectValidModule`, `withTempDataDir` |

`KERNEL_API` vaut `1`. Un module qui declare `apiVersion` superieure est refuse
au chargement par le noyau.

## Ecrire et tester un module

Le guide complet est [`docs/modules/ecrire-un-module.md`](../../docs/modules/ecrire-un-module.md).
Le modele copiable est [`docs/modules/modele/`](../../docs/modules/modele/README.md).

Un test de module n'importe pas le noyau :

```ts
import {
  assertToolOk,
  createTestContext,
  expectValidModule,
  runTool,
  withTempDataDir,
} from "@backstage/module-kit/testing";

it("respecte le contrat", () => {
  expect(() => expectValidModule(module)).not.toThrow();
});

it("ecrit puis relit", async () => {
  await withTempDataDir(async () => {
    const ctx = createTestContext({ moduleId: "demo-notes" });
    assertToolOk(await runTool(addNoteTool, { text: "note" }, ctx));
  });
});
```

`withTempDataDir` redirige le repertoire de donnees du kit vers un dossier
temporaire : un test n'ecrit jamais dans le `data/` de l'hote.

Le paquet n'est pas publie sur npm. Un depot de module teste donc avec un alias
vitest vers un checkout local du kit, decrit dans le guide.

## Modele de confiance

Un module s'execute dans le processus du noyau, avec les memes droits : il n'y
a pas de sandbox. `capabilities.filesystem: "module-data"` est une convention
de chemin, pas une barriere. La politique d'outils (`sideEffect`, `trust`,
confirmation) protege l'utilisateur des appels du modele, pas du code du
module. N'installe que du code que tu peux lire.
