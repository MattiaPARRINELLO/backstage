# Refonte de l'application — plan de migration

> Le système cible est décrit dans [`DESIGN.md`](../DESIGN.md). Ce fichier dit
> **dans quel ordre** et **quoi** toucher. Il ne remplace pas DESIGN.md : en cas
> de doute sur une couleur, un rayon ou une taille, c'est DESIGN.md qui tranche.

## État — 2 novembre 2026

| Phase | Branche | État | Écarts avec le plan |
| --- | --- | --- | --- |
| 0 — socle | `feat/app-refonte-socle` | ✅ livrée | Les primitives ont été écrites dans `app/globals.css` (pas dans un `app/ui.css` séparé) et placées ensuite dans `@layer components` pour rester surchargeables. |
| 1 — shell + chat | `feat/app-shell-chat` | ✅ livrée | Sert de référence de pattern pour les phases suivantes. |
| 2 — journée | `feat/app-journee` | ✅ livrée | — |
| 3 — collections | `feat/app-collections` | ✅ livrée | `app/brain/StatCard.tsx` supprimé au profit des listes à filets. |
| 4 — intégrations | `feat/app-integrations` | ✅ livrée | Le formulaire de rappel a été réécrit ; l'échéance a été conservée. |
| 5 — réglages + entrée | `feat/app-refonte-reglages-login` | ✅ livrée | La séquence décorative du login (explosion, faisceau) a été retirée, l'anneau et l'empreinte sont conservés. |
| Réconciliation | `feat/app-reconciliation` | ✅ livrée | Fusion des cinq branches, unification des `.ui-*`, purge des tokens et du CSS mort, documentation. |

Détail de la réconciliation (conflits, patterns unifiés, tokens retirés) :
[`docs/app-reconciliation.md`](app-reconciliation.md).

Aucun plan de refonte n'est en attente. Les points restés ouverts sont listés
dans [`DESIGN.md` §8](../DESIGN.md#8-ce-qui-reste-ouvert).

## Objectif

L'application tournait sur l'ancienne direction : fond `#0d0c0b`, accent ambre,
mono partout, filets, rayons 8–14 px. La landing était passée au langage moderne
(fond clair, Space Grotesk, bleu `#2547ff`, rayons 12–26, thème clair/sombre).
Il fallait aligner l'application, **page par page, sans casser une seule
fonctionnalité**. C'est fait.

## Règles pour l'agent qui prend une phase

1. **Lire DESIGN.md et `app/landing.css` avant d'écrire une ligne.** Le fichier
   de la landing est l'implémentation de référence (tokens, plaques, cartes,
   boutons) ; ne pas réinventer une valeur.
2. **Aucune valeur en dur** dans les composants : tout passe par les tokens
   `var(--*)`.
3. **Ne jamais toucher à la logique.** Les Server Actions, les routes
   `/api/*`, `lib/chat-runs.ts`, le streaming SSE et les tests ne bougent pas.
   Une phase est un travail de **présentation** : classes, structure JSX,
   variantes de composants. Si un comportement change, c'est un bug.
4. **Server Actions : retour brut + `throw`.** Voir `AGENTS.md`.
5. **Vérifier avant de rendre** : `bunx tsc --noEmit`, `bun run lint`,
   `bun run test`, `bun run build`.
6. **Contrôle visuel** :
   ```bash
   node ~/.config/opencode/skills/design-taste-frontend/scripts/inspect.mjs \
     http://localhost:3000/chat --out .taste-skill/app
   ```
   Les écrans sont derrière passkey : passer par un `storageState` Playwright
   (`e2e/.auth/state.json`) ou tester sur un compte local. Les écarts assumés du
   langage moderne (pastilles, ombre de la carte flottante, filets de liste,
   bordures de carte, mono d'étiquette) se neutralisent avec
   `--allow eyebrow,shadow,hairline,outlined-box,micro-label`.
7. **Un commit par écran cohérent**, message en français, préfixe `feat:` /
   `refactor:`.

## Phase 0 — le socle (bloquant, une seule personne) — ✅ livrée

Rien d'autre ne peut commencer avant. Sans cette phase, chaque agent invente ses
propres tokens.

| Tâche | Fichier |
| --- | --- |
| Porter les tokens de DESIGN.md dans `:root` + `html[data-theme="light"]`, en gardant les noms existants (`--background`, `--foreground`, `--surface-*`, `--text-*`) quand c'est possible | `app/globals.css` |
| Basculer l'application en **sombre par défaut**, le clair disponible (même mécanisme que la landing : `data-theme` + script bloquant déjà dans `app/layout.tsx`) | `app/globals.css`, `app/layout.tsx` |
| Extraire les primitives partagées en classes `.ui-*` (carte, tuile, plaque, bouton, puce, champ, étiquette, mono) | `app/globals.css` (`@layer components`) |
| Rayons, échelles typo, ombre unique, palette `--plate-*` | `app/globals.css` |
| Décider du sort des anciens tokens (`--accent` ambre, `--warm`, `--ai-*`) : les remapper vers le bleu, ou les supprimer et corriger les usages | `app/globals.css` + `grep` des usages |
| Vérifier que la landing continue de fonctionner (elle a ses propres tokens sous `.landing-page`) | — |

**Fini quand** : l'application démarre en sombre, `data-theme="light"` la passe
en clair, les primitives existent, `globals.css` ne contient plus de valeur en
ambre en dur, et la landing est inchangée.

## Phase 1 — le shell et le chat (le cœur) — ✅ livrée

C'est l'écran où l'on vit ; il donne le ton du reste.

| Écran | Fichiers | Cible |
| --- | --- | --- |
| Rail + en-tête | `components/layout/Chrome.tsx` | rail en pastilles 40 px, actif en `--blue-soft` + `--blue`, en-tête sans filet, titre en Space Grotesk 600 |
| Panneau de droite | `components/layout/ContextPanel.tsx` | 5 vues, onglets en puces, panneau `--surface` + `--r-card`, blocs « En retard » en fiche |
| Flux | `components/layout/FluxTimeline.tsx` | ligne de temps sans encadré, jour en mono `--ink-3`, entrées séparées par `1px --line`, pastille d'heure bleue |
| Accueil du chat | `components/chat/HomeHero.tsx` | salutation en Space Grotesk (plus d'Instrument Serif), carte du prochain rendez-vous en plaque, 4 raccourcis en puces |
| Conversation | `components/chat/ChatView.tsx`, `MessageBlocks.tsx` | bulle utilisateur `--surface-2`, réponse sans fond, outils en fiche mono, statut d'outil en couleur sémantique |
| Composer | `components/chat/ChatComposer.tsx` | champ pastille `--surface-2`, bouton d'envoi bleu, ⌘Entrée en mono 13 px |
| Historique | `components/chat/SessionSidebar.tsx` | liste sans filet, actif en `--surface-2`, compteurs en pied en mono |

**Fini quand** : `/chat` en clair et en sombre, envoi d'un message, streaming,
Stop/Esc, outils, pièces jointes, reprise d'une génération après navigation
(`/api/chat/stream`) — tout fonctionne comme avant.

## Phase 2 — la journée — ✅ livrée

| Écran | Fichiers | Cible |
| --- | --- | --- |
| Aujourd'hui | `app/today/page.tsx` (345 l.) | sections nommées (Rappels du jour, Agenda, Cours, Relances), listes à filets, chiffres en mono tabulaire |
| Semaine | `app/week/*` (241 l.) | grille de semaine sans bordure lourde, aujourd'hui marqué par `--blue-soft` |
| Focus | `app/focus/*` (178 l.) | un seul chiffre dominant, anneau supprimé au profit d'une barre |

## Phase 3 — les collections — ✅ livrée

| Écran | Fichiers | Cible |
| --- | --- | --- |
| Photos | `app/photos/*` (970 l., 5 fichiers, `GalleryKanban`) | kanban en colonnes sans filet, cartes `--r-tile` avec vignette, en-tête de colonne en mono, bouton d'ajout en pastille pointillée |
| Cerveau | `app/brain/*` (557 l.), `components/brain/*` | faits en liste à filets, catégories en puces, ajout en champ pastille, graphe conservé tel quel |
| Watch later | `app/watch-later/*` (467 l.) | liste dense, domaine en mono, action en bouton texte |

## Phase 4 — les intégrations — ✅ livrée

| Écran | Fichiers | Cible |
| --- | --- | --- |
| Calendrier | `app/calendar/page.tsx` (462 l.) | grille sobre, événements en aplat `--blue-soft`, pas d'ombre |
| Rappels | `app/reminders/*` (554 l.) | liste groupée par échéance, retard en `--danger`, création en panneau `--r-card` |
| Gmail | `app/gmail/page.tsx` (141 l.) | liste à filets, expéditeur en 500, extrait en `--ink-2` |
| LeetCode | `app/leetcode/page.tsx` (378 l.) | série en chiffre dominant, grille d'activité en carrés `--blue` à opacité variable |

## Phase 5 — réglages et entrée — ✅ livrée

| Écran | Fichiers | Cible |
| --- | --- | --- |
| Réglages | `app/settings/page.tsx` (639 l.) | sections nommées, lignes de réglage (libellé à gauche, contrôle à droite), séparateurs `1px --line` |
| Connexion | `app/login/page.tsx` (279 l.) | carte centrée `--r-card`, passkey en bouton primaire, Instrument Serif accepté ici seulement |
| Recherche, activité, démo, notifications | `app/search`, `app/activity`, `app/demo-calls`, `app/notif`, `app/offline` | héritent du socle ; vérifier seulement la cohérence |

> État (2 novembre 2026) : phase 5 livrée. Réglages en sections nommées + lignes
> à filets, connexion en `.ui-card` centrée (Instrument Serif conservé pour le
> logotype uniquement), écrans secondaires alignés sur les primitives. Captures
> avant/après : `docs/app-refonte/captures/phase5/`.

## Critique / parallélisation

```
Phase 0 (1 agent)
   └── Phase 1 chat + shell (1 agent)
          ├── Phase 2 journée
          ├── Phase 3 collections
          ├── Phase 4 intégrations
          └── Phase 5 réglages + login
```

Les phases 2 à 5 sont indépendantes entre elles : quatre agents peuvent les
prendre en parallèle, chacun sur sa branche, avec `feat/app-refonte-socle`
(phase 0 + 1) comme base commune. **Un agent ne prend jamais deux phases.**

## Definition of done (par phase)

- Aucune valeur de couleur, de rayon ou de taille en dur dans les fichiers
  touchés.
- Les deux thèmes vérifiés (clair et sombre) sur chaque écran livré.
- `tsc`, `eslint`, `vitest`, `build` verts.
- Aucune régression fonctionnelle : les actions, les routes et les flux SSE
  répondent comme avant.
- Captures avant/après dans la description de la PR.
- `DESIGN.md` mis à jour si une décision nouvelle a été prise en cours de route
  (c'est la règle d'`AGENTS.md` : un document périmé est plus dangereux qu'un
  document absent).

## Ce qu'il ne faut pas faire

- Introduire un second accent, une seconde bibliothèque d'icônes, un second
  système de tailles.
- Ajouter des animations d'apparition par section (le tic corrigé sur la
  landing).
- Toucher à `lib/` : la couche données et IA n'est pas concernée.
- Réécrire un écran « au passage » : une phase = une refonte visuelle, pas un
  chantier fonctionnel.
