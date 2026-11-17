# ADR 0001 — Noyau modulaire

- **Statut** : accepté le 2026-11-17, validation humaine des cinq points de la section 5
- **Date** : 2026-11-17
- **Issue** : #84, phases 0 à 9

Les chemins en italique désignent des fichiers que la phase 2 créera : ils
n'existent pas encore dans le dépôt.
- **Journal de diagnostic associé** : [journal de décisions](../refactor/decision-log.md)
- **Décisions amont** : section 8 de #84 (tranchées le 2026-11-16)

---

## 1. Contexte

L'agent expose 25 outils depuis un `switch` unique, le prompt système importe
cinq domaines, la politique de confirmation vit dans cinq fichiers, et une
capacité comme les rappels occupe quinze fichiers répartis sur quatre couches.
Le journal de la phase 0 documente ces constats avec leurs preuves.

La cible est binaire : **ajouter une capacité ne doit demander aucune
modification du noyau**. Un dossier, une ligne dans la configuration.

Cet ADR tranche les cinq points que le diagnostic a laissés ouverts. Il ne
répète pas les décisions déjà prises dans l'issue (deux descriptions par
manifeste, source vendorisée, activation par fichier committé, workspace local,
branche legacy, jobs déclarés).

---

## 2. Décisions

### A. Frontière du noyau et racine de composition

Le noyau comprend :

- `lib/` hors `lib/storage/` et `lib/types/` (moteur de stockage inclus) ;
- `packages/module-kit/` (le contrat) ;
- `app/` (coquille de routage, layout, chrome) ;
- `components/ui/`, `components/layout/` ;
- `proxy.ts`, `scripts/`, `instrumentation.ts`.

Un module vit dans `modules/<id>/`. La direction unique est
`modules/* → noyau`, jamais l'inverse.

**Problème structurel** : quelqu'un doit bien importer les modules pour les
compiler. Ce n'est pas le noyau, c'est une **racine de composition** :
*modules/index.ts*, écrite à la main, qui importe chaque module activé et
exporte la liste.

La seule exception autorisée est un unique fichier du noyau,
*lib/kernel/registry.ts*, qui importe cette racine. La règle de frontière est
donc portée par son chemin exact, pas par une dérogation floue :

- tout fichier de `lib/kernel/` **sauf** *registry.ts* ne peut pas importer
  `modules/` ;
- `app/` ne voit d'un module que son point d'entrée public ;
- `modules/a` ne peut pas importer `modules/b`, jamais.

**Conséquence vérifiable** : `bun run boundaries` échoue si un fichier du noyau
hors racine de composition importe un module.

### B. Contrat de module et version

`packages/module-kit` fournit `defineModule`, `defineTool`, `defineAction`,
`jsonStore`, `verifyWrite`, `toolOk`, `toolError`, les types `ModuleContext`,
`ModuleDefinition`, `ToolDefinition` et les primitives d'interface.

```ts
export default defineModule({
  id: "reminders",
  apiVersion: 1,
  version: "1.0.0",
  label: "Rappels",
  selectionDescription: "Créer, lister et modifier des rappels datés.",
  description: "Rappels avec échéance, récurrence et synchronisation Microsoft To Do.",
  dependencies: [],
  capabilities: { network: ["graph.microsoft.com"], env: ["MICROSOFT_CLIENT_ID"] },
  tools: [addReminder, listReminders],
  prompt: [{ id: "upcoming", priority: 50, render: upcomingRemindersBlock }],
  events: { emits: ["reminder.created"], listens: [] },
  jobs: [{ id: "sync-microsoft", cron: "*/15 * * * *", handler: syncMicrosoft }],
  actions: { create: createReminderImpl, update: updateReminderImpl },
  ui: { page: RemindersPage, rail: { label: "Rappels", icon: Bell } },
});
```

`KERNEL_API = 1`. Un module qui déclare `apiVersion > KERNEL_API` est **refusé**
au chargement, avec un message qui nomme la version du module, la version du
noyau et la marche à suivre (mettre à jour le noyau, ou installer une version
antérieure du module). Un module plus ancien est accepté tant que le kit
supporte sa version.

### C. Deux descriptions, deux usages

`selectionDescription` sert au routage en deux étapes et reste courte, une
phrase, sans paramètres. `description` sert au prompt et à l'écran
d'installation du module. Un outil porte sa propre `description`, longue.

Le routage en deux étapes (module puis outil) n'est **pas activé** tant que le
registre reste sous 40 outils. Le contrat porte le champ dès maintenant pour ne
pas casser l'API plus tard.

### D. Effet de bord, provenance et confirmation

Deux propriétés indépendantes remplacent les trois listes actuelles :

```ts
sideEffect: "none" | "read" | "write" | "external";
trust: "trusted" | "untrusted";   // le résultat peut contenir du contenu tiers
```

Dérivations, dans le noyau, sans aucune liste :

| Propriété | Règle |
| --- | --- |
| `requiresConfirmation` | vrai par défaut pour `external`, surchargeable explicitement |
| confirmable par provenance | `write` ou `external` |
| contamination du tour | un outil `trust` `untrusted` exécuté dans le tour |

`REQUIRE_CONFIRMATION`, `WRITE_TOOLS`, `CONFIRMABLE_TOOLS`, `UNTRUSTED_TOOLS` et
`SIDE_EFFECT_TOOL_NAMES` disparaissent (D-02, D-03).

Le libellé d'une action en attente est fourni par l'outil
(`describeAction: (args) => string`), avec un repli générique côté noyau
(`"<module>.<outil>"`) pour qu'un outil tiers reste lisible sans code du noyau.

### E. Authentification déclarative

Les actions d'un module sont des fonctions pures de transport :
`(input, ctx) => Promise<T>`. Le module expose ses Server Actions dans un fichier
*actions.ts* dédié, sous la forme canonique exigée par Next :

```ts
"use server";
export async function createReminder(input: unknown) {
  return kernelAction("reminders.create", input);
}
```

`kernelAction` fait, pour tout module et dans cet ordre : session, validation
Zod, exécution, journal d'activité, revalidation de chemin.

**Pourquoi pas une enveloppe implicite** : Next exige des exports statiques
`async function` dans un fichier `"use server"`. Une enveloppe qui génère
l'export dynamiquement casse l'analyse du compilateur et rend le nom de
l'action invisible au proxy. La coquille d'une ligne est explicite, uniforme, et
vérifiable par une règle de lint : **aucun appel direct à `requireSession` ou
`getSession` dans `modules/`**.

Le contrat exige que `input` soit typé `unknown` à l'export : la validation est
la seule porte d'entrée, jamais un cast.

### F. Contribution au prompt

Un module décrit ce qu'il apporte au contexte par des **fonctions de rendu**,
pas des fragments figés : le bloc des rappels en attente a besoin de lire les
données.

```ts
prompt: [{ id: "upcoming", priority: 50, render: async (ctx) => "..." }]
```

Le noyau ordonne par priorité décroissante, applique un budget global (valeur
initiale : 1 500 caractères au total, 400 par bloc), tronque proprement et ne
laisse jamais un module casser le prompt : une exception dans `render` retire le
bloc, journalise, et le tour continue.

La liste des outils du prompt est générée depuis le registre **activé**. Un
module désactivé n'apparaît nulle part.

### G. Interface

Le contrat fournit les primitives (`Button`, `Card`, `Field`, classes `.ui-*`)
revendues par le kit ; un module ne les importe jamais depuis le noyau. Le noyau
rend les slots déclarés :

- `page` sur une route unique `app/m/` avec un segment dynamique, créée une fois ;
- `rail`, `panel`, `homeCard` injectés dans le chrome existant.

Un module désactivé n'occupe aucun slot. Un slot absent n'ajoute ni entrée de
navigation ni carte vide.

### H. Données

`jsonStore("<fichier>.json")` écrit dans `data/<module-id>/`, valide en lecture
avec le schéma Zod du module, et expose l'API complète du moteur actuel
(`readJsonSafe`, `writeJsonAtomic`, `mutateJson`, `readOrCreate`, `maybeBackup`,
`newId`, `verifyWrite`). `lib/storage-core.ts` reste l'implémentation interne, et
plus aucun module n'importe le moteur directement (D-18).

`legacyPath` permet de lire `data/reminders.json` sans déplacement. Aucune
donnée existante n'est déplacée ni réécrite par la migration : la bascule
écrit dans l'ancien chemin tant que `legacyPath` est déclaré.

`migrate(from)` ne s'exécute qu'à `module update`, jamais au chargement. Une
migration qui échoue laisse le module dans son état précédent.

### I. Événements et jobs

Bus d'événements **en mémoire**, typé, livraison au mieux, sans durabilité en
v1. Un module publie après commit, jamais avant. Un événement sans abonné ne
produit ni erreur ni log.

Les jobs sont déclarés (identifiant, cron, handler). Le noyau expose une route
unique `/api/cron/[job]`, protégée par le secret de cron existant, et le script
de planification énumère les jobs des modules activés au lieu de deux noms en
dur (D-16).

### J. La mémoire reste une capacité du noyau en v1

Décision assumée, contraire à l'objectif « zéro domaine dans le noyau » : la
mémoire alimente le prompt de *chaque* tour et l'extraction de *chaque* réponse.
La migrer d'abord reviendrait à faire du module pilote le plus couplé du
système, exactement le risque identifié dans l'issue.

Elle devient donc une capacité noyau déclarée, avec une échéance de réexamen :
la migration de la mémoire est le premier chantier de la phase 5 **après** que
deux modules aient été migrés sans modification du noyau.

### K. Distribution et modèle de confiance

`modules.config.json` (committé) dit quels modules sont activés.
`modules.lock.json` (committé) fige `repo`, `ref`, `commit`, `installedAt`.
Une version de module est toujours un commit, jamais une branche. `git status`
reste propre après installation : clone + écriture des deux fichiers, rien
d'autre.

Un module exécute du code arbitraire dans le processus serveur. Il peut lire
`.env.local` et `data/`. **Ce n'est pas une sandbox.** Les capacités déclarées
sont documentaires, affichées et confirmées à l'installation ; elles ne sont pas
appliquées en v1. L'isolation réelle est hors périmètre, avec une note
d'architecture pour v2.

---

## 3. Conséquences

**Positives**

- Une capacité devient un dossier, son activation une ligne de configuration.
- La politique de confirmation devient une propriété du type, donc vérifiable
  par le compilateur, plus par cinq listes à garder d'accord.
- Un module se teste sans navigateur : outils, actions, stockage et jobs sont
  des fonctions.
- Un module peut être extrait puis réinstallé depuis git sans toucher au noyau.

**Négatives, assumées**

- Deux indirections nouvelles : la racine de composition et `kernelAction`.
- Un build Next reste obligatoire après installation d'un module.
- Une API versionnée à maintenir : chaque rupture de contrat coûte une montée de
  `KERNEL_API` et une note de migration.
- Le modèle de confiance est brutal : un module tiers compromis compromet tout.

**Risques et parades**

| Risque | Parade |
| --- | --- |
| Le noyau se remplit de cas particuliers « pour ce module » | la phase 5 est le test : si le noyau change deux fois pour deux modules, retour à cet ADR |
| Les règles de frontière rassurent sans mordre | un test crée un faux import interdit et vérifie que `boundaries` échoue (D-19) |
| Le contrat se fige sur le mauvais axe | deux modules migrés avant toute extraction |
| Régression silencieuse sur une app quotidienne | strangler, ancien chemin intact, `legacyPath`, un commit réversible par domaine, scénarios dorés de #86 comme filet |

---

## 4. Points explicitement non tranchés

Ils appartiennent à une phase ultérieure, pas à cet ADR :

- **Isolation d'exécution** des modules tiers : hors périmètre v1, note d'architecture en v2.
- **Durabilité des événements** : non, en v1. Un événement perdu au redémarrage est accepté.
- **Publication npm** du kit : après stabilisation, pas avant.
- **Seuil exact du routage en deux étapes** : 40 outils est une estimation, à
  mesurer sur la latence réelle.

---

## 5. Validation

Validé par Mattia le 2026-11-17, sur les cinq points :

- [x] A. La racine de composition unique (*lib/kernel/registry.ts*) est la bonne exception à la règle « le noyau n'importe pas les modules ».
- [x] D. `external` implique la confirmation par défaut ; seul un module peut la retirer explicitement, jamais le noyau.
- [x] E. La coquille d'une ligne par Server Action est acceptée comme coût de l'authentification déclarative.
- [x] F. Le budget de prompt (1 500 caractères au total, 400 par bloc) est retenu, à ajuster sur l'usage réel.
- [x] J. La mémoire reste au noyau en v1, avec réexamen après deux modules migrés.

La phase 2 peut écrire du noyau. Les phases 3 et 4 en dépendent directement.
