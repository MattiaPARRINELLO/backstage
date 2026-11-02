# DESIGN.md — Backstage

> État au 2 novembre 2026. La **landing** est migrée ; l'**application** ne l'est
> pas encore. Ce fichier décrit le système cible, pas l'état de chaque écran.
> Le plan de migration est dans [`docs/app-refonte.md`](docs/app-refonte.md).

---

## 1. Le principe

Un espace personnel qui se lit comme un **outil de travail**, pas comme un site.
Le contenu porte la richesse ; le chrome reste silencieux : surfaces, espace,
un seul accent.

Deux règles qui décident de tout le reste :

1. **Un seul accent.** Le bleu `#2547ff` signale l'action, la sélection et la
   donnée qui compte. Le rouge est réservé à l'urgence et aux retards. Rien
   d'autre n'est coloré.
2. **Aucune décoration.** Pas de dégradé décoratif, pas de halo, pas d'ombre
   portée sauf sur une surface qui flotte réellement (carte de contexte, menu
   mobile). La profondeur vient des paliers de surface et des filets.

---

## 2. Couleurs

### Thème clair (défaut de la landing)

| Rôle | Valeur | Usage |
| --- | --- | --- |
| `--bg` | `#f7f8fa` | fond de page |
| `--surface` | `#ffffff` | cartes, panneaux |
| `--surface-2` | `#f1f3f7` | sections alternées, champs |
| `--ink` | `#0a0b0d` | texte principal, titres |
| `--ink-2` | `#545a66` | texte courant |
| `--ink-3` | `#6b7280` | notes, légendes, étiquettes |
| `--line` | `#e6e9ef` | séparateurs, bordures de carte |
| `--line-2` | `#d8dce4` | bordure au survol, contour de bouton |
| `--blue` | `#2547ff` | accent, action primaire |
| `--blue-ink` | `#ffffff` | texte sur bleu |
| `--blue-soft` | `#e8edff` | fond d'accent discret |
| `--blue-line` | `#c9d3ff` | bordure d'accent |

### Thème sombre

| Rôle | Valeur |
| --- | --- |
| `--bg` | `#0a0b0d` |
| `--surface` | `#14161a` |
| `--surface-2` | `#101215` |
| `--ink` | `#f2f4f8` |
| `--ink-2` | `#b7bcc6` |
| `--ink-3` | `#9aa0ab` |
| `--line` | `rgba(242,244,248,.10)` |
| `--line-2` | `rgba(242,244,248,.20)` |
| `--blue` | `#7d94ff` (éclairci pour tenir le contraste AA sur noir) |
| `--blue-ink` | `#0a0b0d` |
| `--blue-soft` | `rgba(125,148,255,.15)` |
| `--blue-line` | `rgba(125,148,255,.45)` |

### Plaques (surfaces inversées)

Une carte peut s'inverser : plaque sombre sur page claire, plaque claire sur
page sombre. C'est ce qui donne au produit son « écran dans la page ».

| Rôle | Clair | Sombre |
| --- | --- | --- |
| `--plate-bg` | `#0a0b0d` | `#f4f6fa` |
| `--plate-ink` | `#f2f4f8` | `#0a0b0d` |
| `--plate-2` | `#cbcfd8` | `#3a3f4a` |
| `--plate-3` | `#7d838f` | `#6b7280` |
| `--plate-line` | `rgba(242,244,248,.12)` | `rgba(10,11,13,.10)` |
| `--plate-acc-bg` | `rgba(37,71,255,.14)` | `#e9eeff` |
| `--plate-acc-ink` | `#b9c6ff` | `#1b34c4` |

### Sémantique

| Rôle | Valeur | Usage |
| --- | --- | --- |
| urgence | `#d98878` (sombre) / `#b42318` (clair) | en retard, échec |
| succès | `#9bbf8a` | série tenue, envoi réussi |
| avertissement | `#e0a45e` | **hérité de l'ancienne direction** : à réévaluer lors de la migration, ne pas propager sans décision |

Le thème est porté par `<html data-theme="light|dark">`. Le script bloqueur de
`app/layout.tsx` le pose avant la première peinture (suit
`prefers-color-scheme`, sauf `localStorage["pb-theme"]`).

---

## 3. Typographie

| Rôle | Police | Réglage |
| --- | --- | --- |
| Titres, noms de blocs, chiffres forts | **Space Grotesk** (`--font-display`) | 600, `letter-spacing: -0.03em` à `-0.045em`, `line-height: 0.96–1.05` |
| Texte, interface | **Inter** (`--font-sans`) | 400/500, `line-height: 1.5–1.6` |
| Étiquettes, heures, montants, code | **JetBrains Mono** (`--font-mono`) | 400, `font-variant-numeric: tabular-nums` |
| Éditorial (login uniquement) | Instrument Serif (`--font-editorial`) | 400 — **ne pas étendre**, la landing n'en veut plus |

### Échelle — cinq tailles visibles maximum

| Token | Valeur | Usage |
| --- | --- | --- |
| `--t-display` | `clamp(2.35rem, 4.8vw, 4.25rem)` | titre de premier écran |
| `--t-head` | `clamp(1.75rem, 3vw, 2.75rem)` | titres de section |
| `--t-lead` | `clamp(1.125rem, 1.3vw, 1.375rem)` | chapô, question, réponse mise en avant |
| `--t-body` | `1.03125rem` (16,5 px) | texte courant |
| `--t-small` | `0.8125rem` (13 px) | notes, étiquettes, légendes |

Règles :

- **Jamais de texte lisible sous 13 px.** Les libellés de données passent en
  mono à 13 px, pas à 11.
- Un titre tient en **deux lignes** à toutes les largeurs. Au-delà : couper des
  mots, élargir la mesure, baisser la taille en dernier.
- Les paragraphes courent sur **45 à 75 caractères** (`max-width: 34rem` typique).
- Pas de majuscules espacées en étiquette : c'est le tic le plus daté. Casse
  normale, 13 px, `--ink-3`.
- Pas d'italique dans les titres.

---

## 4. Espace, formes, profondeur

| Token | Valeur |
| --- | --- |
| `--r-card` | `26px` |
| `--r-tile` | `18px` |
| `--r-sm` | `12px` |
| pastille (bouton, puce) | `999px` |
| gouttière de grille | `8–10px` |
| marge de page | `20 → 28 → 40px` (`--pad`), conteneur `1320px` |

- **Une seule paire de marges** par page, conteneur centré.
- **Rythme vertical variable** : `88px` (dense), `104px` (courant), `152px`
  (respiration). Une page où toutes les sections ont le même padding est plate.
- **Une ombre** : `0 40px 90px -50px rgba(10,12,20,.55)`, réservée aux surfaces
  qui flottent (carte de contexte, menu mobile, dialogue). Jamais sur une carte
  posée.
- Bordures : `1px solid var(--line)` pour une carte sur fond clair ; pas de
  bordure quand le palier de surface suffit (carte blanche sur `--surface-2`).

### Composition

- Une section = un titre qui la nomme, puis son contenu. **Pas d'étiquette
  au-dessus du titre.**
- Les grilles de boîtes identiques sont interdites : varier les largeurs
  (`2fr 1fr 1fr`), ou remplacer la carte par une fiche technique à filets.
- Une colonne ne reste jamais vide : le vide se ferme par une image, une
  colonne, une liste ou un champ de couleur.

---

## 5. Composants

| Composant | Forme | États |
| --- | --- | --- |
| Bouton primaire | pastille, `--blue` / `--blue-ink`, `height: 50px`, `padding: 0 24px` | survol `#1a37e0`, actif `translateY(1px)`, désactivé `opacity .55`, focus `outline 2px --blue` offset 3 |
| Bouton secondaire | pastille, bordure `--line-2`, fond transparent | survol : bordure `--ink` |
| Bouton texte | souligné, `--ink-2` | survol : `--ink` |
| Carte | `--r-card` ou `--r-tile`, `--surface`, `1px --line`, padding `24–34px` | — |
| Plaque | carte inversée (`--plate-*`) | la seule à porter une ombre |
| Champ | `--r-sm` ou pastille, fond `--surface-2`, pas de bordure | focus : bordure `--blue-line` |
| Puce / puce-filtre | pastille, `1px --line`, `--t-small` | survol : bordure `--line-2` |
| Étiquette de donnée | mono 13 px, `--ink-3` | pas de pastille, pas de majuscules |
| Liste de données | lignes séparées par `1px --line`, pas de boîte | — |
| État vide | titre 1 ligne + une phrase, aucun dessin | — |

Aucun composant ne porte d'icône décorative. Les icônes viennent toutes de
**Lucide** (une seule bibliothèque, `strokeWidth 1.5–1.6`).

---

## 6. Mouvement

- **Deux mouvements, pas trente.** Une entrée orchestrée à l'ouverture (titre,
  puis phrase, puis action, décalage 60–90 ms) et une dérive lente des images au
  défilement. Le reste de la page est posé : pas d'apparition par section.
- Courbe unique `cubic-bezier(.22,1,.36,1)`. Durées : 120 ms (press),
  150–200 ms (couleur), 600–900 ms (entrée).
- `transform` et `opacity` uniquement. Jamais de largeur, hauteur ou `top`.
- `prefers-reduced-motion` supprime tout déplacement, garde le contenu.
- Un contrôle répond au survol, au focus clavier et au press. Un élément non
  cliquable n'a pas d'état de survol.

---

## 7. Ce qui est acquis (landing)

`app/landing.css` porte l'implémentation de référence : tokens, `--plate-*`,
cartes, plaques, puces, boutons, bandeaux photo, thème sombre. **Toute décision
non écrite ici se règle en lisant ce fichier**, pas en inventant.

Landing = `components/landing/*`, un fichier par section, contenu éditorial
centralisé dans `app/landing-content.ts`.

## 8. Ce qui reste à faire (application)

L'application tourne encore sur l'ancienne direction (sombre, ambre, mono
partout, filets). Les tokens de ce fichier ne sont **pas** dans
`app/globals.css`, qui porte encore `--background: #0d0c0b` et
`--accent: #e0a45e`.

Ordre de travail et structure cible de chaque écran :
[`docs/app-refonte.md`](docs/app-refonte.md).

## 9. Accessibilité

- Contraste minimum 4,5:1 pour le texte, 3:1 pour les éléments d'interface.
- Focus visible partout : `outline: 2px solid var(--blue); outline-offset: 3px`.
- Tout contrôle a un nom accessible ; les icônes seules ont un `aria-label`.
- Une seule `h1` par page ; chaque section a un titre qui la nomme.
- Les libellés de formulaire sont visibles (ou `sr-only` si le contexte suffit),
  et les erreurs sont annoncées (`role="alert"`).
