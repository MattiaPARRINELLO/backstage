# Journal de décisions du chantier modulaire

Phase 0 de l'issue #84. Diagnostic en **lecture seule** de `lib/`, `app/actions/`,
`app/api/` et `components/`, consigné ici avec une preuve par entrée.

Ce fichier n'invente aucune architecture. Il constate, il cite `fichier:ligne`,
et il renvoie chaque décision à la phase qui la traitera. L'architecture cible
est tranchée par l'ADR de la phase 1, pas ici.

**Méthode** : lecture directe, `wc -l`, `grep -n`, `git ls-files`, sur `main` au
commit `bdc970b`. Aucun code n'a été modifié pour l'établir.

**Format d'une entrée** : constat, preuve, décision, phase. Une entrée sans
preuve n'a pas sa place ici.

---

## 1. État mesuré

| Zone | Fichiers | Lignes |
| --- | --- | --- |
| `lib/types/` | 18 | 497 |
| `lib/storage/` | 15 | 1 066 |
| `app/actions/` | 22 | 1 447 |
| `app/api/` (routes) | 39 | 4 353 |
| Croissance de `lib/chat-tools.ts` depuis l'issue | 854 → 1 017 | +163 |

Le fichier de dispatch a grossi de 19 % pendant que l'issue était ouverte, sans
qu'aucune capacité nouvelle soit ajoutée : la dérive est structurelle, pas
imputable à une fonctionnalité.

| Métrique | Constat |
| --- | --- |
| Outils déclarés | 25 (`lib/chat-tools.ts:218`) |
| `case` dans le dispatch | 25 (`lib/chat-tools.ts:615`) |
| `requireSession()` dans `app/actions/` | 68 occurrences, 22 fichiers |
| Listes d'outils ou de domaines codées à la main | 7 (voir D-02, D-03, D-08, D-09) |

---

## 2. Journal des décisions

### D-01 — `lib/chat-tools.ts` porte cinq responsabilités

**Constat** : déclarations des outils, politique de confirmation, registre des
actions en attente, aide à la relecture et dispatch cohabitent dans un fichier de
1 017 lignes.

**Preuve** : `lib/chat-tools.ts:58` (politique), `:114-204` (registre),
`:218-543` (déclarations), `:552-563` (relecture), `:605-1 016` (dispatch).

**Décision** : le noyau garde le registre, la politique et l'exécution générique.
La déclaration d'un outil devient une donnée typée, portée par le module.

**Phase** : 2 (types et registre), 6 (suppression du `switch`).

### D-02 — Trois listes d'outils par effet, déjà divergentes

**Constat** : `WRITE_TOOLS` compte 13 noms, `SIDE_EFFECT_TOOL_NAMES` en compte
14. L'écart est `prepare_concert`, classé « effet de bord » d'un côté et absent
des écritures de l'autre. Aucune règle ne dit laquelle fait foi.

**Preuve** : `lib/chat-tools.ts:82`, `lib/tool-result.ts:105`.

**Décision** : un seul champ `sideEffect` dans la déclaration d'outil
(`none | read | write | external`). `CONFIRMABLE_TOOLS` et
`SIDE_EFFECT_TOOL_NAMES` deviennent des projections, jamais des listes.

**Phase** : 2 (contrat), 6 (suppression des listes).

### D-03 — La politique de confirmation vit dans cinq fichiers

**Constat** : exiger une confirmation demande aujourd'hui deux éditions dans
`chat-tools`, plus un libellé côté route, plus un libellé côté client, plus la
carte de confirmation. Les deux libellés sont deux `switch` de six cas qui
doivent rester d'accord sans test commun.

**Preuve** : `lib/chat-tools.ts:58`, `:82`, `:104`,
`app/api/chat/route.ts:110`, `components/chat/ChatView.tsx:46`.

**Décision** : `requiresConfirmation` est dérivé de `sideEffect` par défaut, et
le libellé d'une action en attente devient une donnée du module. La route et le
client ne réécrivent plus de `switch` métier.

**Phase** : 2 (dérivation), 6 (route et client génériques).

### D-04 — Le registre des actions en attente est correct mais mal placé

**Constat** : registre en mémoire, TTL de quinze minutes, plafond de cinquante
entrées, clé canonique, consommation à usage unique. Le comportement répond à la
classe décrite en #76 et il est testé. Le problème est son emplacement, pas sa
conception.

**Preuve** : `lib/chat-tools.ts:127-204`, `app/api/chat/confirm-batch/route.ts:42-71`.

**Décision** : déplacement à l'identique dans le noyau, sans changement de
comportement. Toute modification de cette mécanique exige son propre commit et
ses propres tests.

**Phase** : 2.

### D-05 — La relecture après écriture est un service du noyau

**Constat** : six outils relisent leurs données après écriture pour ne pas
annoncer un succès inexistant. La fonction est locale au fichier de dispatch,
donc invisible pour un module.

**Preuve** : `lib/chat-tools.ts:552`, appels en `:726`, `:740`, `:781`, `:800`,
`:921`.

**Décision** : `verifyWrite` entre dans le contrat de module, sinon chaque module
réinventera (ou omettra) sa relecture.

**Phase** : 2.

### D-06 — Le prompt système importe cinq domaines

**Constat** : le prompt lit directement le stockage de la mémoire, du
calendrier, des shootings et des rappels, et formate leurs blocs. Un module
extrait demain ne peut pas contribuer au contexte sans éditer le noyau.

**Preuve** : `lib/chat-prompts.ts:1`, blocs en `:120-162`.

**Décision** : chaque module déclare ses contributions de contexte (titres,
requêtes, formatage) ; le noyau les ordonne et applique un budget. La mémoire
reste dans le noyau tant qu'elle n'est pas migrée, elle perd simplement son
privilège d'import direct.

**Phase** : 5 (première contribution non noyau), 6 (généralisation).

### D-07 — La liste d'outils du prompt est un `join` de noms

**Constat** : la phrase « Tu as acces a ces outils » est construite depuis le
tableau des 25 déclarations, sans description courte par module ni budget de
tokens.

**Preuve** : `lib/chat-prompts.ts:164`.

**Décision** : la liste est générée depuis le registre **activé**, avec les deux
descriptions exigées par la décision 1 de l'issue (courte pour la sélection,
longue pour le prompt).

**Phase** : 2 (deux descriptions au contrat), 6 (génération).

### D-08 — La route de chat connaît six domaines par un `switch`

**Constat** : le résumé d'une carte de confirmation est produit par un `switch`
local sur les noms d'outils. Un outil de module tiers y tombe dans `default` et
s'affiche sous son identifiant brut.

**Preuve** : `app/api/chat/route.ts:110-127`.

**Décision** : le libellé appartient à l'outil ; la route ne garde que le
protocole SSE, la boucle d'itérations et l'honnêteté des résultats.

**Phase** : 6.

### D-09 — Trois surfaces d'interface énumèrent les outils et les domaines

**Constat** : le panneau de contexte associe treize outils à un libellé et une
icône, le fil de chat décrit six actions, la navigation latérale liste quinze
destinations. Un module installé n'apparaît dans aucune des trois.

**Preuve** : `components/layout/ContextPanel.tsx:311`,
`components/chat/ChatView.tsx:46`, `components/layout/Chrome.tsx:40`.

**Décision** : libellé, icône et slot de navigation viennent du manifeste. Les
entrées inconnues gardent un rendu de repli lisible (nom de l'outil, pas de
carte vide).

**Phase** : 6 (repli générique), 7 (slots du module pilote).

### D-10 — `requireSession` est appelé à la main 68 fois

**Constat** : 68 appels dans 22 fichiers d'actions, en première ligne de chaque
action. Une action oubliée est une action publique dès que `proxy.ts` ne la
couvre pas.

**Preuve** : `grep -c "requireSession()" app/actions/*.ts`.

**Décision** : l'authentification devient une propriété de l'action déclarée,
portée par le noyau. L'ADR doit trancher le mécanisme (enveloppe explicite ou
vérification au point d'entrée), car un wrapping implicite casse la lisibilité
des Server Actions et l'analyse statique du proxy.

**Phase** : ADR (phase 1), application en phase 3 sur le module pilote.

### D-11 — La forme en quatre couches est répliquée seize fois

**Constat** : seize domaines se répartissent entre types, stockage, actions et
routes, sans qu'aucun fichier ne déclare l'ensemble.

**Preuve** : `lib/types/` (18 fichiers), `lib/storage/` (15),
`app/actions/` (22), `app/api/` (39 routes).

**Décision** : migration en strangler, un domaine par PR, ancien chemin intact
jusqu'à la bascule. Aucune migration de masse.

**Phase** : 3 à 5.

### D-12 — Les rappels, capacité la plus simple, occupent 15 fichiers

**Constat** : 1 158 lignes réparties sur quinze fichiers, plus trois outils dans
le dispatch et une part de deux fichiers partagés.

**Preuve** :

| Fichier | Lignes |
| --- | --- |
| `app/reminders/page.tsx` | 265 |
| `app/actions/reminders.ts` | 124 |
| `app/reminders/ReminderForm.tsx` | 116 |
| `app/reminders/ReminderRow.tsx` | 103 |
| `app/reminders/timeline.ts` | 57 |
| `lib/storage/reminders.ts` | 70 |
| `lib/types/reminders.ts` | 23 |
| `app/reminders/PermissionPill.tsx` | 38 |
| 4 routes `app/api/reminders/**` | 91 |
| 1 route `app/api/cron/reminders/route.ts` | 18 |
| 2 fichiers de tests | 176 |

S'y ajoutent `lib/reminder-sync.ts` (123 lignes, dédié) et une part de
`lib/notification-scheduler.ts` et de `lib/chat-tools.ts`.

**Décision** : pilote de la phase 3, avec `legacyPath` vers `data/reminders.json`
pour ne déplacer aucune donnée.

**Phase** : 3 et 4.

### D-13 — Actions et Route Handlers se recouvrent sans test commun

**Constat** : la récurrence est calculée dans le stockage, consommée par la route
`recur`, tandis que la modification de statut vit dans l'action. Aucun test ne
vérifie que les deux chemins produisent le même résultat.

**Preuve** : `lib/storage/reminders.ts:43`,
`app/api/reminders/[id]/recur/route.ts:1-25`, `app/actions/reminders.ts:109`.

**Décision** : un service de domaine unique, deux transports minces. Le
recouvrement reste assumé (clients non-React), il cesse d'être dupliqué.

**Phase** : 3.

### D-14 — `lib/reminder-sync.ts` est un service de domaine rangé à la racine

**Constat** : le fichier importe le stockage, le client Microsoft et le cache
serveur. Il n'est utilisé que par les rappels, mais il vit au même niveau que le
noyau.

**Preuve** : `lib/reminder-sync.ts:1-11`, appelé depuis
`app/actions/reminders.ts:16-21`.

**Décision** : devient un fichier interne du module. Le client Microsoft, lui,
reste dans le noyau : c'est une intégration partagée.

**Phase** : 3.

### D-15 — `lib/notification-scheduler.ts` couvre quatre domaines

**Constat** : 671 lignes pour quatre échéanciers distincts et l'envoi de push.

**Preuve** : `lib/notification-scheduler.ts:251` (emploi du temps), `:413`
(rappels), `:491` (intentions), `:532` (brief quotidien).

**Décision** : l'envoi de push devient un port du noyau ; chaque échéancier
devient un job déclaré par son module (décision 6 de l'issue).

**Phase** : 2 (port), 3 et 5 (migration des échéanciers).

### D-16 — Le cron est câblé en dur sur deux noms

**Constat** : le script accepte deux tâches littérales, deux scripts npm les
exposent, et `proxy.ts` ouvre tout le préfixe sans consulter aucun registre.

**Preuve** : `scripts/cron-scheduler.ts:4`, `package.json:25`,
`proxy.ts:45`.

**Décision** : le script lit le registre des jobs des modules activés. Le
préfixe public reste unique, la liste des tâches cesse d'être un littéral.

**Phase** : 2 (registre), 8 (CLI et planification).

### D-17 — Un outil du noyau invalide le cache d'un domaine

**Constat** : l'envoi d'email déclenche une invalidation dont le motif est propre
à Gmail, écrit dans le dispatch du noyau.

**Preuve** : `lib/chat-tools.ts:637`.

**Décision** : le module invalide son propre cache dans l'exécution de son outil.
Le noyau ne connaît aucun motif de cache métier.

**Phase** : 6.

### D-18 — Le barrel de stockage est partiel

**Constat** : `lib/storage.ts` ne ré-exporte que deux primitives du moteur, donc
douze fichiers importent le moteur directement. La surface publique est
trompeuse, et la doc doit le rappeler.

**Preuve** : `lib/storage.ts:3`, importateurs directs de `lib/storage-core.ts`
(relevés dans `lib/storage/`, `lib/app-config.ts`, `lib/auth.ts`,
`lib/fcm-devices.ts`, `lib/passkey-pairing.ts`, `lib/push-subscriptions.ts`).

**Décision** : `jsonStore` expose une API complète et unique. Aucun correctif
intermédiaire du barrel : ce serait un churn sans bénéfice.

**Phase** : 2 (API), 3 (premier usage réel).

### D-19 — Les règles de frontières existent mais gardent des dossiers vides

**Constat** : deux règles interdisent déjà les imports inter-modules et
l'accès direct aux fichiers internes d'un module depuis `app/`. Elles ne
mordent sur rien, faute de dossier.

**Preuve** : `.dependency-cruiser.cjs:51`, `:58`.

**Décision** : aucune règle à ajouter en phase 2. En revanche, un test doit
prouver que les règles mordent réellement, sinon on garde une garde morte qui
rassure à tort.

**Phase** : 2 (test), 3 (premier passage réel).

**Statut** : fait. `scripts/__tests__/boundaries.test.ts` copie la vraie
configuration dans un dossier temporaire, monte un faux import interdit par
règle (`modules-isoles`, `app-limite-aux-manifestes`, `kit-sans-noyau`),
vérifie que `depcruise` sort en erreur, et qu'un import autorisé passe. La
copie est faite à l'exécution : retirer une règle du dépôt casse le test.

### D-20 — Aucun workspace n'existe

**Constat** : `packages/` et `modules/` sont absents, `package.json` ne déclare
aucun `workspaces`, et Next compile la racine telle quelle.

**Preuve** : `package.json:12`, `bun.lock`.

**Décision** : la phase 2 ajoute `workspaces: ["packages/*"]`. Le paquet de
contrat est consommé en source TypeScript, sans build séparé, sinon `next build`
exige une étape de compilation supplémentaire et la porte `tsc --noEmit` ne
couvre plus le contrat.

**Phase** : 2.

### D-21 — Un module tiers ne peut pas importer les primitives d'interface

**Constat** : `components/ui/` est hors du périmètre distribuable, et une règle
interdit à `lib/storage/` d'importer des composants. Un module qui voudrait une
page devrait donc importer le noyau par chemin interne, ce que les règles
refusent.

**Preuve** : `.dependency-cruiser.cjs:33`,
`docs/architecture/srp.md` § 4.

**Décision** : les primitives d'interface sont passées au module par le contrat,
pas importées. Constat consigné, arbitrage en ADR puis en phase 7.

**Phase** : ADR (phase 1), 7 (slots du module pilote).

### D-22 — Les tests actuels verrouillent le comportement à préserver

**Constat** : un test affirme « exactement 25 outils », les scénarios dorés de
#86 vérifient la sélection, et le registre d'actions en attente a ses tests.

**Preuve** : `lib/__tests__/agent-scenarios.test.ts:194`, `:236`,
`app/actions/__tests__/reminders.test.ts`,
`app/api/reminders/__tests__/pending.test.ts`.

**Décision** : ce sont les filets du passage au registre. Leur **sortie** ne
change pas pendant la migration ; seule leur source d'alimentation change (le
registre au lieu du tableau).

**Phase** : 2 et 6.

---

## 3. Ce que le diagnostic ne tranche pas

Ces points appartiennent à l'ADR de la phase 1, qui doit être validé
humainement avant la moindre ligne de noyau :

1. **Authentification déclarative** : enveloppe explicite autour d'une action, ou
   vérification au point d'entrée ? La première est lisible, la seconde est
   infalsifiable.
2. **Libellés d'action** : dans le manifeste (donc traduisibles) ou générés
   depuis le schéma Zod ? Le second évite la duplication, le premier donne une
   phrase utile.
3. **Contributions de prompt** : fonctions exécutées par le noyau, ou fragments
   de texte déclarés ? Les fonctions sont puissantes, les fragments sont
   vérifiables hors exécution.
4. **Primitives d'interface** : props injectées, ou paquet séparé versionné ?
5. **Frontière du noyau** : la mémoire reste-t-elle du noyau (elle alimente le
   prompt de tous les tours) ou devient-elle un module privilégié ?

---

## 4. Mise à jour de ce fichier

Une entrée s'ajoute quand un constat est mesuré, jamais quand une intention est
formulée. Une entrée ne se réécrit pas : un constat périmé est remplacé par une
entrée qui cite la précédente et la date.

Le fichier se supprime le jour où la phase 6 est close : à ce moment-là, ce
qu'il décrit n'existe plus dans le code.
