# Plan de journée — 24 novembre 2026

Source : issue #82 (pilotage) + issues ouvertes au 23/11. `main` à `bc00014`, CI verte, 1124 tests.

## État de départ

- Vague 0 tranchée : pas de déploiement immédiat.
- Vague 1 en cours : #251 et #256 fermées, **#250** et **#261** à faire.
- Vague 2 (#142) débloque l'envoi automatique de la relance d'accréditation.
- Vagues 3 et 4 : réserve de travail net (petites corrections, tests, doc).

## Objectif du jour

Fermer la vague 1 : #250 puis #261, avec preuves (tests, typecheck, lint, boundaries). Préparer la sortie de vague 1 (mise en ligne) sans la déclencher sans accord. En parallèle, traiter la PR #262 (scan IA) qui accompagne #260, déjà ouverte et mergeable.

## Bloc 0 — FAIT : PR #262 (scan IA, accompagne #260)

PR mergée le 24/11/2026 (`--merge --delete-branch`). Checks verts (lint, typecheck, tests, build, E2E, dependency-review, gitleaks, GitGuardian). Relecture du diff : client Groq avec rotation sur plusieurs clés, pont `ctx.ai.json` dans le noyau et repli sur le modèle de conversation, réécriture du scan en extraction JSON validée par Zod, garde-fou Rapstar, tests couvrant extraction, refus sans IA, réponse illisible, statut jamais rétrograde, fiche incomplète complétée, écriture vérifiée. Aucune erreur bloquante trouvée. Commentaire ajouté sur #82.

## Bloc 1 — Matin (~3 h) : #250 refactor(search)

Objectif : la recherche lit les accréditations via le store/service du module, suppression de `lib/storage/accreditations.ts`.

Étapes :
1. Lire `modules/accreditations/store.ts` et `modules/accreditations/schema.ts` pour identifier le service de lecture exposé.
2. Lire `app/actions/search.ts` et `lib/storage/accreditations.ts`.
3. Remplacer l'import `getAccreditations` de `@/lib/storage` par l'accès au module (store/service).
4. Supprimer `lib/storage/accreditations.ts` et son entrée dans le barrel `lib/storage.ts`.
5. Mettre à jour les tests qui référencent `lib/storage/accreditations.ts`.
6. Vérifier : `bunx tsc --noEmit`, `bun run test`, `bun run boundaries`, `bun run check:docs`.
7. Commit : `refactor(search): lire les accreditations via le store du module`.

Critère de fin : aucun appelant de `lib/storage/accreditations.ts` ; fichier supprimé ; tests verts.

## Bloc 2 — Après-midi (~3 h) : #261 marquer les fiches incertaines

Objectif : une fiche issue d'une extraction approximative est signalée « à vérifier » et n'alimente ni le prompt de relance ni le compteur d'accueil tant qu'elle n'est pas confirmée.

Étapes :
1. `modules/accreditations/schema.ts` : ajouter `needsReview` (ou équivalent) sans changer `status`.
2. `modules/accreditations/tools.ts` : `extractionSchema` porte un indicateur de confiance ou la liste des champs douteux (`artist`, `venue`, `concertDate`).
3. Scan : créer la fiche avec `needsReview` si incertaine ; ne pas remplacer une fiche marquée par une extraction incertaine sans signaler.
4. Page `/m/accreditations` : badge « À vérifier » + filtre.
5. Prompt de relance et compteur d'accueil : exclure les fiches `needsReview` non confirmées.
6. Correction manuelle (édition ou changement de statut) lève la marque.
7. Tests unitaires sur le calcul et le filtre.
8. Vérifier : `bunx tsc --noEmit`, `bun run test`, `bun run lint:budget`.
9. Commit(s) granulaires : schema, scan, ui, prompt/compteur, tests.

Critère de fin : badge + filtre visibles ; une fiche incertaine n'apparaît pas dans le prompt de relance ni le compteur ; test qui le prouve.

## Bloc 3 — En fin de journée (~1 h) : une tâche S de réserve

Si le bloc 2 est terminé et qu'il reste du temps, prendre une tâche courte de la vague 3 pour garder la dynamique. Premier choix : #257 (remplacer `window.location.href` par `useRouter().push` dans `MicrosoftTodoPanel.tsx`), S, libère une place du plafond de warnings. Alternative si bloqué : #246 ou #243 (S).

Commit : `fix(todo): navigation interne via useRouter dans MicrosoftTodoPanel`.

## Préparation de sortie de vague 1 (sans déploiement)

À la fin du jour, si #250 et #261 sont fermés avec preuves et `main` vert, préparer la checklist de mise en ligne (voir issue #82, section « Mise en ligne ») :

1. `./deploy.sh` depuis le checkout principal (archive avant rsync).
2. `CRON_BASE_URL=https://backstage.mprnl.fr bun run cron:list` doit lister quatre jobs.
3. Ajouter la ligne de crontab `0 * * * * ... /api/cron/accreditations-follow-up` côté cPanel.
4. Ouvrir `/m/accreditations` et une page de module ancienne : un seul `load` au montage.
5. Confirmer où est sauvegardé le `data/` de production, puis fermer #247.

Le déploiement touche la production : il se fait avec accord explicite. Ne pas le lancer sans validation.

## Hors vague (ne pas toucher aujourd'hui)

- #245 (27 worktrees) : jamais automatiquement, certains contiennent un `data/` avec des jetons.
- #215 et les lots de tests (#216-#222) : réserve de volume, à intercaler si bloqué.
- #142 (envoi d'email neuf) : vague 2, à ouvrir après la vague 1.

## Vérifications de fin de journée

- PR #262 traitée (mergée ou blocage documenté), `main` vert.
- `bun run lint` (plafond 11) et `bun run lint:budget`.
- `bunx tsc --noEmit` et `bun run typecheck:strict`.
- `bun run test`.
- `bun run boundaries` et `bun run check:docs`.
- Working tree propre, chaque unité committée.