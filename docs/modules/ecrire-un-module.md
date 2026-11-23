# Ecrire un module BACKSTAGE

Ce guide suffit pour ecrire, tester, installer, mettre a jour, desactiver et
retirer un module. Tu n'as pas besoin de lire le noyau : tout ce dont un module
depend est decrit ici et fourni par le paquet `@backstage/module-kit`.

Le modele copiable vit dans [`modele/`](modele/README.md). Tous les chemins
cites dans ce guide existent dans ce dossier ou dans le depot hote.

---

## 1. Ce qu'est un module

Un module est un dossier autonome qui ajoute une capacite a BACKSTAGE. Il
possede :

- un **manifeste** (`module.ts`) qui declare son identifiant, sa version, ses
  outils, ses actions, ses jobs et ses slots d'interface ;
- ses **outils**, appeles par le modele de chat ;
- ses **actions**, appelees par sa page, toujours via le noyau qui porte la
  session et la validation ;
- son **store**, un ou plusieurs fichiers JSON dans `data/<id>/` ;
- sa **page**, son entree de rail, son panneau et sa carte d'accueil,
  optionnels et injectes par le noyau ;
- ses **tests**, qui n'importent jamais le noyau.

Il ne touche pas : l'authentification, le routage, le chrome, le prompt
systeme, la politique de confirmation, le stockage des autres modules. Il ne
peut pas importer un autre module, ni un fichier du noyau. Ses seuls imports
externes sont `@backstage/module-kit`, ses sous-chemins, `zod`, et les pairs
fournis par l'hote (`react`, `lucide-react`, `next`).

L'identifiant est en kebab-case et devient le namespace de tout : outil
`<id>.<outil>`, actions `<id>.<action>`, route `/m/<id>`, donnees
`data/<id>/`.

---

## 2. Creer le module minimal

Copie [`modele/`](modele/README.md) dans un nouveau depot git, puis renomme
`demo-notes` partout. Un module minimal tient en cinq fichiers.

### Le manifeste

`module.ts` est obligatoire a la racine du depot : c'est le seul fichier que
`module:add` lit avant d'installer.

```ts
import { defineModule, railIcon } from "@backstage/module-kit";

import { createNoteAction, listNotesAction } from "./actions";
import { addNoteTool } from "./tools";
import NotesPage from "./ui/page";

const noteIcon = railIcon('<path d="M4 4h16v16H4z" />');

export default defineModule({
  id: "demo-notes",
  apiVersion: 1,
  version: "0.1.0",
  label: "Notes",
  selectionDescription: "Ajouter et lire des notes.",
  description: "Notes en texte libre, avec ecriture verifiee et page dediee.",
  capabilities: { filesystem: "module-data" },
  tools: [addNoteTool],
  actions: { list: listNotesAction, create: createNoteAction },
  ui: {
    page: NotesPage,
    rail: { label: "Notes", icon: noteIcon },
  },
});
```

Regles verifiees par `defineModule` et par `module:add` :

| Champ | Regle |
| --- | --- |
| `id` | kebab-case commencant par une lettre, unique dans le noyau |
| `apiVersion` | entier positif, inferieur ou egal a l'API du noyau (`1`) |
| `version` | semver (`0.1.0`, pas `v0.1.0`) |
| `label`, `selectionDescription` | non vides ; la seconde tient en une phrase |
| `description` | non vide, pour le prompt et l'ecran d'installation |
| noms d'outils | snake_case, uniques dans le module |
| jobs | identifiant kebab-case, cron a cinq champs, handler fonction |

Le fichier `index.ts` ne sert qu'a la surface publique :

```ts
export { default } from "./module";
```

### L'outil

Un outil est une fonction pure qui rend un `ToolOutput`. Le statut est porte
par la donnee, jamais devine a partir du texte.

```ts
import { defineTool, toolError, toolOk, verifyWrite } from "@backstage/module-kit";
import { z } from "zod";

import { notesStore } from "./store";

export const addNoteTool = defineTool({
  name: "add",
  description: "Ajoute une note en texte libre.",
  params: z.object({ text: z.string().trim().min(1) }),
  sideEffect: "write",
  run: async (args, ctx) => {
    const note = { id: crypto.randomUUID(), text: args.text, createdAt: new Date().toISOString() };
    await notesStore.mutate((data) => {
      data.notes.push(note);
    });

    const failure = await verifyWrite("la note", async () => {
      const { notes } = await notesStore.read();
      return notes.some((stored) => stored.id === note.id);
    });
    if (failure) return toolError(failure);

    await ctx.activity?.("note_created", `Note ajoutee : ${note.text}`);
    return toolOk(`Note ajoutee : ${note.text}`);
  },
});
```

`sideEffect` decide de la politique du noyau : `none`, `read`, `write` ou
`external`. `external` exige une confirmation utilisateur par defaut ; un
module peut la retirer explicitement, jamais le noyau. `trust: "untrusted"`
declare que le resultat contient du contenu tiers (page web, email) et
contamine le tour.

### L'action et la page

Une action est une fonction `(input, ctx) => Promise<T>` validee par Zod cote
noyau. La page ne l'appelle jamais directement : elle passe par
`useModuleAction`, fourni par la route du module.

```ts
import { defineAction } from "@backstage/module-kit";
import { z } from "zod";

import { notesSchema } from "./schema";
import { notesStore } from "./store";

export const listNotesAction = defineAction({
  name: "list",
  input: z.object({}),
  run: async () => {
    const { notes } = await notesStore.read();
    return notesSchema.parse(notes);
  },
});
```

```tsx
"use client";

import { PageHeader, useModuleAction } from "@backstage/module-kit";
import { useCallback, useEffect, useState } from "react";

import { notesSchema, type Note } from "../schema";

export default function NotesPage() {
  const call = useModuleAction();
  const [notes, setNotes] = useState<Note[]>([]);

  const load = useCallback(async () => {
    setNotes(notesSchema.parse(await call("list", {})));
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ui-page">
      <PageHeader title="Notes" />
      {/* liste et formulaire, voir le modele */}
    </div>
  );
}
```

Regles d'interface : importer les primitives depuis le kit (`PageHeader`,
`EmptyState`, `Skeleton`), utiliser les classes `.ui-*` pour l'apparence, ne
jamais ecrire une couleur ni un rayon. L'icone du rail vient de `railIcon()`
avec un trace SVG declaratif, pas d'un composant client.

### Le store

`jsonStore` namespacce le fichier, valide en lecture comme en ecriture et
ecrit de facon atomique.

```ts
import { jsonStore } from "@backstage/module-kit/json-store";

import { notesDataSchema } from "./schema";

export const notesStore = jsonStore({
  moduleId: "demo-notes",
  file: "notes.json",
  schema: notesDataSchema,
  fallback: { notes: [] },
});
```

Le fichier resultant est `data/demo-notes/notes.json`. `legacyPath` permet de
lire un fichier historique a la racine de `data/` sans le deplacer.

---

## 3. Tester

Le kit fournit un contrat de test publiable, sans noyau :

```ts
import {
  assertToolOk,
  createTestContext,
  expectValidModule,
  runTool,
  withTempDataDir,
} from "@backstage/module-kit/testing";

import module from "../module";
import { notesStore } from "../store";
import { addNoteTool } from "../tools";

it("respecte le contrat", () => {
  expect(() => expectValidModule(module)).not.toThrow();
});

it("ecrit et relit une note", async () => {
  await withTempDataDir(async () => {
    const ctx = createTestContext({ moduleId: "demo-notes" });
    assertToolOk(await runTool(addNoteTool, { text: "Premiere note" }, ctx));
    const { notes } = await notesStore.read();
    expect(notes).toHaveLength(1);
  });
});
```

| Helper | Role |
| --- | --- |
| `createTestContext({ moduleId })` | `ModuleContext` factice ; `logs`, `events` et `activityEntries` capturent |
| `runTool(outil, args, ctx)` | valide le schema puis execute l'outil ; arguments invalides et exception deviennent un resultat `error`, comme le noyau |
| `assertToolOk` / `assertToolError` / `assertToolEmpty` | assertion lisible sur `ok`, `error`, `empty` |
| `expectValidModule(module, { kernelApi })` | memes regles que le noyau a l'installation |
| `withTempDataDir(async (dir) => {})` | redirige le store vers un dossier temporaire, puis le retire |

Cas a couvrir au minimum : arguments invalides refuses avant ecriture, entree
nominale avec relecture du store, dependance optionnelle absente (`ctx.ai`,
`ctx.net`) sans levee, et manifeste valide.

### Le point qui bloquait : tester hors du depot hote

Un module n'est pas compile par le build Next tant qu'il n'est pas installe,
et le kit n'est pas publie sur npm. La reponse est un **alias vitest vers le
checkout du kit**, plus les `paths` TypeScript equivalents.

`vitest.config.ts` :

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

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
  test: { environment: "node" },
  resolve: { alias },
});
```

Les alias sont des expressions exactes, pas des prefixes : sans le `$`, le
sous-chemin `/testing` serait remplace par `index.ts/testing`.

`tsconfig.json` reprend les memes cibles :

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "paths": {
      "@backstage/module-kit": ["../backstage/packages/module-kit/src/index.ts"],
      "@backstage/module-kit/*": ["../backstage/packages/module-kit/src/*"]
    }
  }
}
```

Le depot du module et `backstage/` sont voisins par defaut. Sinon, definir
`BACKSTAGE_KIT` pour vitest et ajuster `paths` pour TypeScript : les deux
doivent pointer vers le **meme** checkout, et ce checkout doit contenir le
sous-chemin `testing` (kit de cette version, pas une version anterieure).
`tsconfig.json` ne lit pas les variables d'environnement : il faut y ecrire le
chemin en clair.

`package.json` du module :

```json
{
  "peerDependencies": { "@backstage/module-kit": "*", "zod": "^4.0.0" },
  "peerDependenciesMeta": { "@backstage/module-kit": { "optional": true } },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "react": "^19.2.4",
    "typescript": "^5.0.0",
    "vitest": "^4.0.0",
    "zod": "^4.6.0"
  }
}
```

Le `peerDependenciesMeta.optional` n'est pas cosmetique : sans lui, `bun
install` essaie de resoudre `@backstage/module-kit` sur npm et echoue en 404,
puisque le paquet n'est pas publie. `@types/node` est necessaire a `tsc` pour
les modules `node:fs`, `node:path` et la globale `process`.

Lancement (le script `test` appelle vitest ; `bun test` lancerait le lanceur
integre de Bun, qui ne comprend pas les imports vitest) :

```bash
bun install
bun run test
bun run typecheck
```

`withTempDataDir` garantit qu'aucun test n'ecrit dans `data/` du depot hote :
le kit resout `data/` a chaque appel, et le helper le redirige.

---

## 4. Installer

Depuis le depot hote, la source est un depot git et une **ref epinglee** (tag
ou commit, jamais une branche) :

```bash
bun run module:add https://github.com/toi/backstage-module-demo-notes.git#v0.1.0
bun run module:list
bun run module:doctor
bun run build
```

Un chemin local vers un depot git fonctionne de la meme facon :

```bash
bun run module:add /chemin/vers/le/module#v0.1.0
```

`module:add` :

1. clone la ref dans un dossier temporaire, puis retire son `.git` ;
2. verifie le manifeste (`id`, `apiVersion`, champs obligatoires) avant toute
   ecriture ;
3. ecrit `modules/<id>/`, `modules.config.json` (active), `modules/index.ts`
   (racine de composition) et enfin `modules.lock.json` (commit fige) ;
4. restaure les trois fichiers si une ecriture echoue.

`module:list` affiche le lock : identifiant, commit, `repo#ref`, date.
`module:doctor` verifie presence, activation, manifeste et dossiers temporaires
orphelins. Un code de sortie `1` signifie un probleme.

Le build est **obligatoire** : Next ne cree pas de route a l'execution, et la
liste des modules actifs est importee statiquement.

Pieges :

- un tag doit etre pousse (`git push --tags`), sinon le clone echoue ;
- un depot prive se clone avec ta session git ; si `GITHUB_TOKEN` est defini
  dans `.env.local` pour un autre depot, lance `GITHUB_TOKEN= bun run module:add ...` ;
- un module deja installe se met a jour, il ne se reinstalle pas.

---

## 5. Mettre a jour

```bash
bun run module:update demo-notes
bun run module:update demo-notes #v0.2.0
bun run build
```

- sans ref, la ref du lock est **reinstallee** : ce n'est pas un `git pull`,
  un tag deplace ou une branche mise a jour ne change rien ;
- avec une ref, `ref` et `commit` sont remplaces et `installedAt` rehorodate ;
- l'etat active ou desactive est conserve : `modules.config.json` n'est pas
  reecrit ;
- `update` refuse une version dont l'identifiant de manifeste change, ou dont
  `apiVersion` depasse celle du noyau.

Si l'identifiant change, ce n'est plus le meme module : `module:remove <ancien>`
puis `module:add <source>#<ref>`. Les donnees de l'ancien restent dans
`data/<ancien>/`, a migrer explicitement si necessaire.

---

## 6. Desactiver

```bash
bun run module:disable demo-notes
bun run build
```

`disable` ne modifie que `modules.config.json`. Le module reste dans
`modules/index.ts` et dans le lock, mais il disparait des six surfaces :
page `/m/<id>`, entree de rail, panneaux, carte d'accueil, outils du modele et
bloc de prompt. Aucun slot vide n'est rendu.

Le rebuild est obligatoire : la configuration est importee statiquement au
build, pas relue a chaque requete. Redemarrer le serveur ne suffit pas.

```bash
bun run module:enable demo-notes
bun run build
```

---

## 7. Retirer

```bash
bun run module:remove demo-notes
bun run build
```

`remove` supprime le dossier `modules/<id>/`, l'entree de
`modules.config.json`, l'import de `modules/index.ts` et l'entree de
`modules.lock.json`. Il deplace d'abord le dossier, puis restaure tout si une
ecriture echoue.

Ne sont **pas** supprimees : les donnees `data/<id>/`. Un module retire puis
reinstalle retrouve ses donnees. Pour les effacer, supprime le dossier de
donnees toi-meme, apres une sauvegarde.

---

## 8. Modele de confiance et limites de la v1

A lire avant de publier, et a repeter dans le README du module.

- **Pas de sandbox.** Un module s'execute dans le processus du noyau, avec les
  memes droits. Il peut lire `.env.local`, `data/`, et tout ce que le processus
  peut lire. Un module tiers compromis compromet l'application entiere.
- **Les capacites sont declaratives.** `capabilities.filesystem: "module-data"`
  est une convention de chemin, pas une barriere : rien n'empeche
  techniquement un module d'ecrire ailleurs. `network` et `env` sont affiches
  et confirmes a l'installation, jamais appliques.
- **La politique d'outils protege l'utilisateur du modele, pas du module.**
  `sideEffect`, `trust` et la confirmation empechent le modele de declencher
  une ecriture ou un envoi sans accord. Elles ne contraignent pas le code du
  module, qui peut appeler n'importe quoi directement.
- **Les dependances entre modules sont interdites.** Seule la racine de
  composition nomme des modules ; un module n'importe jamais un autre module.
- **Une desactivation exige un rebuild**, parce que la configuration est
  importee statiquement.
- **`module:update` sans ref n'est pas un `git pull`** : il reinstalle la ref
  du lock. Une branche n'est jamais une version.

Consequence pratique : n'installe que des modules dont tu peux lire le code, et
epingle un commit ou un tag que tu as verifie.

---

## 9. Checklist avant de publier

- [ ] `module.ts` exporte `defineModule` par defaut, `index.ts` ne fait
      qu'exporter le manifeste.
- [ ] `id` en kebab-case, unique, present partout (manifeste, store, actions,
      URL de revalidation).
- [ ] `version` en semver, `apiVersion` a `1`, tag git pousse.
- [ ] `bun run test` passe dans le depot du module ; les cas d'erreur et le
      store sont couverts.
- [ ] `bun run typecheck` passe avec `strict` et `noUncheckedIndexedAccess`.
- [ ] Aucun import hors kit, `zod`, `react`, `lucide-react`, `next` ;
      `grep -rn "@/lib" .` est vide, et aucun fichier du noyau n'est importe.
- [ ] Chaque ecriture d'outil est relue (`verifyWrite`) et rend un `ToolOutput`
      honnete.
- [ ] `sideEffect` et `trust` decrivent le comportement reel ; aucun outil
      externe ne retire la confirmation sans raison.
- [ ] La page utilise les classes `.ui-*` et les primitives du kit.
- [ ] Le README du module dit ce qu'il possede, ses donnees, ses capacites, et
      repete qu'il n'y a pas de sandbox.
- [ ] Installation verifiee de bout en bout : `module:add`, `module:list`,
      `module:doctor`, `bun run build`, `bun run test`.
