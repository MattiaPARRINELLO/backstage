# Charte de responsabilité unique

Cette charte ne remplace ni le refactor modulaire (#84) ni le découpage des
gros fichiers. Elle répond à une seule question, la même aux trois échelles :
**qu'est-ce qu'une responsabilité, ici ?**

Sans définition écrite, chacun décide au feeling et la revue de code devient une
négociation. C'est ce qui produit des fichiers de 1 000 lignes : personne n'a
jamais dit où était la limite.

## 1. La règle de lecture

Un critère unique, applicable partout : **une unité doit avoir une seule raison
de changer.**

La formulation utile n'est pas « est-ce que ce fichier fait une seule chose ? »
mais :

> **Quels changements, dans le monde extérieur, obligent à modifier cette
> unité ?**

Si la réponse contient deux causes indépendantes, il y a deux responsabilités.
Si elle contient une seule cause, l'unité est cohérente, même si elle est
longue.

Trois exemples réels du dépôt, un par verdict :

| Unité | Causes de changement | Verdict |
| --- | --- | --- |
| `components/chat/ChatView.tsx` | l'API du chat, le design du fil, les raccourcis clavier, la politique d'autoscroll | quatre causes indépendantes, à séparer |
| `lib/storage-core.ts` | le format de stockage, et seulement lui | une cause, à garder tel quel |
| `lib/storage/concerts.ts` | le modèle concert (la météo est sortie vers `lib/weather.ts` en #89) | une cause, corrigé |

## 2. Échelle fonction

Une fonction fait une chose à **un seul niveau d'abstraction**.

| Règle | Cible | Garde-fou |
| --- | --- | --- |
| Longueur | ≤ 60 lignes | `max-lines-per-function` (warn) |
| Paramètres | ≤ 4 | `max-params` (warn) |
| Complexité cyclomatique | ≤ 12 | `complexity` (warn) |
| Profondeur d'imbrication | ≤ 4 | `max-depth` (warn) |
| Niveau d'abstraction | un seul par fonction | revue |
| Nom | décrit l'intention, pas l'implémentation | revue |

Deux règles de fond valent plus que les seuils :

- **une fonction ne mélange pas orchestration et détail.** Une fonction qui
  `fetch`, valide, transforme et écrit fait quatre choses à quatre niveaux.
- **une fonction nomme son intention.** `reconcileRemindersWithMicrosoft` est
  bon. `handleData` ne l'est pas.

Contre-exemple historique, corrigé en #89 : `lib/storage/concerts.ts` ouvrait
une IIFE qui allait chercher la météo puis formatait une phrase. La fonction de
persistance décidait donc aussi de la disponibilité d'OpenWeatherMap. La météo
vit désormais dans `lib/weather.ts`.

Le seuil de 60 lignes est un **signal**, jamais une décision : une fonction de
40 lignes qui valide, décide et écrit est trop grosse, une fonction de 70 lignes
qui déroule une table de correspondance ne l'est pas.

## 3. Échelle fichier

Un fichier raconte **une** chose, dans un ordre lisible de haut en bas.

| Règle | Cible | Garde-fou |
| --- | --- | --- |
| Longueur | ≤ 300 lignes | `max-lines` (warn) |
| Export public | un export principal | revue |
| Nom | décrit la responsabilité, pas le type | revue |
| Ordre | types, constantes, fonction principale, helpers privés en bas | revue |
| Effets de bord | déclarés par le nom (`-client`, `-storage`, `-actions`) | revue |

Exception assumée : une **table de données** (constantes, mapping, dictionnaire
de libellés) peut dépasser la limite si elle est cohésive et sans logique. Le
dépassement se justifie en commentaire d'en-tête.

Contre-exemple : `components/chat/ChatView.tsx` fait 1 006 lignes et porte au
moins sept responsabilités (état du fil, streaming, outils actifs, autoscroll,
raccourcis, commentaires de sélection, gestion de session). Ce n'est pas un
problème de longueur, c'est quatre causes de changement dans un fichier.

Bon exemple : `lib/storage-core.ts` expose six primitives (`newId`,
`writeJsonAtomic`, `mutateJson`, `readJsonSafe`, `maybeBackup`, `readOrCreate`),
chacune avec une responsabilité, et le fichier change pour une seule raison : le
format de stockage.

## 4. Échelle dossier

- **un dossier par capacité**, jamais par couche technique. C'est la décision de
  #84 ; cette charte n'en ajoute pas.
- **pas de fourre-tout.** `utils`, `helpers`, `misc`, `common` grossissent sans
  propriétaire. Un helper vit à côté de ce qu'il sert, ou dans le noyau s'il est
  réellement transverse.
- **un dossier doit pouvoir être supprimé** sans laisser de cadavre. Si le
  supprimer casse quinze fichiers ailleurs, ce n'est pas une capacité, c'est une
  couche mal placée.
- **pas de dossier d'un seul fichier** sans raison : `lib/types/reminders.ts`
  seul ne justifie pas un dossier, c'est le symptôme d'un découpage par couche.

Test rapide : « si je supprime ce dossier, qu'est-ce qui casse ? » Si la réponse
est « rien, sauf ses propres imports », c'est une capacité. Si la réponse est
« la moitié de l'application », c'est une couche qui prétend être une capacité.

## 5. Ce que la responsabilité unique ne veut pas dire

À écrire, parce que c'est là que ce principe fait des dégâts :

- **ce n'est pas « une fonction par fichier »** : dix fichiers de vingt lignes
  reliés par des imports sont moins lisibles qu'un fichier cohérent de deux
  cents lignes ;
- **ce n'est pas « la fonction la plus courte possible »** : une fonction de
  trois lignes qui délègue à trois autres ajoute de l'indirection sans rien
  clarifier ;
- **ce n'est pas découper sur le nombre de lignes** : les seuils sont un signal,
  jamais une décision ;
- **un module profond bat trois modules superficiels** : une petite interface
  qui cache une implémentation complexe est l'objectif, pas l'inverse ;
- **la cohésion prime sur la taille** : un fichier de 350 lignes qui raconte une
  seule chose est préférable à trois fichiers qui se renvoient la balle.

## 6. Checklist de revue

À utiliser en revue de PR, pas en découverte de code. Quatre questions, dans cet
ordre :

1. **Causes de changement** : quels changements extérieurs obligent à modifier
   cette unité ? Deux causes indépendantes → demander le découpage.
2. **Niveau d'abstraction** : la fonction mélange-t-elle orchestration et
   détail ? Le fichier mélange-t-il plusieurs couches ?
3. **Nom** : le nom dit-il l'intention, ou le type (`handle`, `process`,
   `utils`) ?
4. **Suppression** : si on supprime l'unité ou le dossier, que casse-t-il ? La
   réponse doit rester locale.

Une PR qui ajoute une responsabilité sans le dire (par exemple un `fetch` dans
un store, une couleur en dur dans un composant) se refuse sur la question 1, pas
sur la longueur du fichier.

## 7. Garde-fous vérifiables

Cette section liste ce que l'outillage peut encoder, pour que la charte ne reste
pas une intention. **Aucun de ces contrôles n'est actif aujourd'hui** : ils sont
la matière de #85 (frontières de dépendance) et d'une future PR de cliquet.

| Règle de la charte | Contrôle encodable | Où |
| --- | --- | --- |
| `lib/storage/**` sans réseau | interdiction de `fetch` hors du port HTTP | #85, règle 6 (différée avec #89) |
| `lib/storage/**` sans React/Next | interdiction des imports `react`, `next/*` | #85, règle 3 |
| `components/**` sans couche serveur | interdiction de `fs`, `next/headers` | #85, règle 4 |
| un dossier = une capacité | pas d'import entre modules | #85, règles 1 et 2 |
| configuration centralisée | `process.env` interdit hors `lib/config.ts` | #85, règle 5 (avec #88) |
| fichiers trop longs | `max-lines` en avertissement, plafond figé en CI | PR de cliquet dédiée |
| fonctions trop grosses | `max-lines-per-function`, `complexity`, `max-depth` | PR de cliquet dédiée |

Le cliquet, et non l'erreur immédiate : 29 fichiers dépassent déjà 300 lignes.
Casser la CI le premier jour empêcherait toute contribution. Le plafond de
warnings se fige, descend à chaque PR de nettoyage, et devient une erreur quand
il atteint zéro.

## 8. Ce que cette charte ne fait pas

- Elle ne découpe aucun fichier. Les cinq pires cas sont traités séparément.
- Elle ne remplace pas la carte du code ([`code-map.md`](../contributing/code-map.md)),
  qui dit où poser un nouveau fichier.
- Elle ne décide pas de l'architecture des modules : c'est #84.
