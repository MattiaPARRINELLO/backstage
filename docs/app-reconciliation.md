# Réconciliation de la refonte — 2 novembre 2026

Cinq branches parties du même socle, cinq interprétations. Cette note garde la
trace de ce qui a été tranché, pour que le prochain agent n'ait pas à le
redécouvrir. Le système cible est dans [`DESIGN.md`](../DESIGN.md) ; l'ordre des
phases est dans [`app-refonte.md`](app-refonte.md).

## 1. Intégration des branches

Ordre : `feat/app-shell-chat` (référence de pattern), `feat/app-journee`,
`feat/app-collections`, `feat/app-integrations`,
`feat/app-refonte-reglages-login`.

**Aucun conflit git.** Les branches touchaient des pages disjointes ; le socle
commun avait déjà figé `globals.css`, et aucune branche n'a réécrit le même
fichier. Ce qui a dû être tranché, ce sont les **divergences silencieuses** :

| Divergence | Décision |
| --- | --- |
| Composants React (`Button`, `Card`, `Input`, `Pill`) toujours sur l'ancienne direction alors que les pages utilisaient `.ui-*` | Les composants délèguent désormais aux classes `.ui-*` : une seule source d'apparence |
| Surcharges locales `h-9!`, `px-4!`, `h-auto!` pour contourner la hauteur fixe des primitives | Variantes nommées `--sm`, `--xs`, `--icon`, `--block`, `--area`, `--tile` ; primitives passées dans `@layer components` pour être surchargeables sans `!` |
| Chip de raccourci transformée en tuile par cinq `!` | `.ui-chip--tile` |
| Bouton rond ad hoc dans `AddFactForm` | `.ui-btn--primary --sm --icon` |
| Trois façons d'écrire du mono (`font-mono`, `ui-mono`, `font-mono text-[10px]`) | `.ui-mono` partout |
| Rayons Tailwind (`rounded-md/lg/xl/2xl`) réintroduits par endroits | `--r-sm`, `--r-tile`, `--r-card` |
| Textes à 9–12 px dans les composants hérités (widgets, Markdown, palette, raccourcis) | Plancher de 13 px (`--t-small`) sur `app/` et `components/` |

## 2. Patterns unifiés

| Élément | Source unique | Variantes |
| --- | --- | --- |
| Bouton | `.ui-btn` | `--primary`, `--ghost`, `--quiet`, `--danger`, `--text`, tailles `--sm` / `--xs` / `--icon` / `--block` |
| Carte | `.ui-card` | `elevated` (palier `--surface-2`), `ghost` |
| Tuile | `.ui-tile` | — |
| Plaque | `.ui-plate` | — |
| Puce | `.ui-chip` | `[data-active]`, `--tile` |
| Champ | `.ui-field` | `--area`, `--boxed` |
| Étiquette | `.ui-label` | — |
| Mono | `.ui-mono` | — |

Supprimés : `components/ui/IconBadge.tsx` (aucun usage), `.animate-*` en double,
`.glass`, `.surface-1/2/3`, `.border-subtle/default/strong`, `.text-muted`,
`.text-faint`, `.ring-focus`, `.gradient-*`, `.shimmer`, `.typing-text`,
`.transition-height`, `.fade-out-up`, `.tool-scan`, `.tool-progress-bar`.

## 3. Tokens retirés

`--warm`, `--accent-warm`, `--accent-cool`, `--violet-deep`, `--ai-thinking`,
`--ai-tool-call` — déclarations et mappings `@theme` supprimés, **25 usages
réécrits** vers `--accent`, `--text-2/3`, `--danger` ou `--warning`.

L'ambre ne survit que comme `--warning` (#e0a45e en sombre, #b4530f en clair)
pour : hors-ligne, mise à jour disponible, connexion Google expirée, difficulté
« moyenne » LeetCode. Un badge de workflow n'utilise plus l'ambre.

Hex en dur supprimés : `#0a0a0b` (bouton d'erreur), `#0b0b0d` (bloc de code),
`#d4a373` / `#8f91a0` / `#f5f3f0` (bannière Google), `#fbbf24` / `#f87171`
(jauge de série, dégradé remplacé par un trait `--accent`). Restent assumés :
`themeColor` des métadonnées et les presets d'accent utilisateur.

## 4. Bugs trouvés en vérifiant les parcours

| Symptôme | Cause | Correctif |
| --- | --- | --- |
| Un fait ajouté dans `/brain` était écrit sur disque mais restait invisible jusqu'au rechargement | `revalidatePath` dans `rememberFact` écrase l'état local avant le `setData` | `handleAdd` relit `loadBrain()` après l'action |
| La puce « maintenant » apparaissait devant **chaque** entrée future de la journée | `showNow` était calculé par ligne | calculée sur la première entrée à venir du groupe |
| Le rappel clavier sous le chat annonçait « Entrée envoie » alors que le code exige `Ctrl/Cmd+Entrée` | copie obsolète | texte corrigé |
| Le bouton passkey du login débordait sur deux lignes | hauteur fixe 44 px | hauteur auto + `min-h-11` |

## 5. Purge CSS

38 classes mortes retirées de `app/globals.css` : halos et trame de l'accueil,
particules, `sheen`, pendule du badge, orbites, `shimmer`, `tool-scan`,
`breathe`, anneaux et explosion du login, `flux-now`, `panel-sheen`,
`home-ambience`, `home-glow`, `home-halo`, `login-burst*`, `login-scan-beam`,
`login-shockwave`, `login-tick`. Les animations conservées sont listées dans
`DESIGN.md` §6.

## 6. Vérifications

- 19 routes visitées en clair et en sombre, en 1440 px et en 390 px :
  aucune erreur console, aucun débordement horizontal, aucun texte sous 13 px.
- Parcours : envoi d'un message et streaming, Stop/Esc, création + modification
  + suppression d'un rappel, glisser-déposer d'une carte photo, ajout d'un fait
  en mémoire, synchronisation LeetCode, persistance du thème après navigation.
- `bunx tsc --noEmit`, `bun run lint`, `bun run test` (517), `bun run build` :
  verts.
- Limites de l'environnement de test : les appels LeetCode peuvent répondre 429
  (quota de l'API publique) et l'ajout en mémoire prend plusieurs secondes
  (`findSimilarMemoryFacts`), sans que ce soit une régression.
