# backstage-module-demo-notes

Module d'exemple pour BACKSTAGE : notes en texte libre. Copie ce dossier comme
point de depart, renomme l'identifiant partout (`module.ts`, `store.ts`,
`modules.config.json` cote hote), puis suis le guide
[Ecrire un module](../ecrire-un-module.md).

## Contenu

| Fichier | Role |
| --- | --- |
| `index.ts` | surface publique : le noyau n'importe que ce fichier |
| `module.ts` | manifeste `defineModule`, obligatoire a la racine du depot |
| `schema.ts` | schemas Zod des donnees |
| `store.ts` | `jsonStore` dans `data/<id>/notes.json` |
| `tools.ts` | outil `add`, ecriture verifiee par relecture |
| `actions.ts` | actions `list` et `create` appelees par la page |
| [ui/page.tsx](ui/page.tsx) | page rendue sur `/m/demo-notes` |
| `__tests__/` | contrat de test, sans noyau |
| `vitest.config.ts` | alias vers le checkout du kit |

## Tester

Le kit n'est pas publie. Les tests pointent vers le checkout du depot noyau :
par defaut `../backstage/packages/module-kit/src`, sinon :

```bash
BACKSTAGE_KIT=/chemin/vers/backstage/packages/module-kit/src bun run test
```

Le `tsconfig.json` contient les memes chemins (`paths`) et doit etre ajuste en
consequence. Le test n'ecrit jamais dans le `data/` du depot hote :
`withTempDataDir` redirige le store vers un dossier temporaire.

```bash
bun install
bun run test
bun run typecheck
```

## Installer

Depuis le depot hote, avec une ref epinglee (tag ou commit) :

```bash
bun run module:add https://github.com/toi/backstage-module-demo-notes.git#v0.1.0
bun run module:list
bun run module:doctor
bun run build
```

## Retirer

```bash
bun run module:disable demo-notes
bun run build
bun run module:remove demo-notes
bun run build
```

## Modele de confiance

Un module s'execute dans le processus du noyau, avec les memes droits. Il n'y a
pas de sandbox. `capabilities.filesystem: "module-data"` est une convention de
chemin, pas une barriere. Ne publie que du code que l'utilisateur peut lire.
