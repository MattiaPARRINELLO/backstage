# DESIGN.md — BACKSTAGE

## Direction

La régie d'une salle, la nuit. Ramp neutre chaude (rideau, flight case), une
seule lumière de travail ambre, les heures et les chiffres en mono.
Rien ne brille, rien ne flotte : la richesse est dans les données réelles
(fiche de contexte, ligne de temps, mémoire), pas dans le chrome.

Cette direction est commune à la landing et à l'application. Un seul jeu de
tokens dans `app/globals.css`.

## Palette

- **Background**: `#0d0c0b`
- **Surface**: `#121110` / `#191715` / `#201d1a`
- **Border**: `rgba(239, 233, 222, .08)` / `.13` / `.20`
- **Text primary**: `#efe9de`
- **Text secondary**: `#aba49a`
- **Text muted**: `#8a8279` / `#6f6a63`
- **Accent ambre**: `#e0a45e` (`--accent-soft` `#f0c08a` pour le texte sur fond sombre)
- **Success**: `#9bbf8a` · **Danger**: `#d98878`

Règles :

- Un seul accent, rare : action primaire, sélection, chiffre qui compte.
- Les surfaces restent neutres, même dans un tableau de bord. Pas de fond
  teinté orange/bleu/vert.
- Pas de dégradé de teinte, de texte en dégradé, de halo coloré, ni d'ombre
  colorée. La profondeur vient des paliers de surface et des hairlines.
- Un dégradé n'est admis que comme variation d'un même neutre.

## Typographie

- **Sans** : Inter (`--font-inter`) — interface.
- **Mono** : JetBrains Mono (`--font-jetbrains-mono`) — heures, chiffres,
  libellés de données, `tabular-nums`.
- **Éditorial** : Instrument Serif (`--font-editorial`) — hero de la landing,
  salutation de l'accueil, mot BACKSTAGE du login. Nulle part ailleurs.
- **Display** : Space Grotesk (`--font-display`) — titres de page.
- Casse normale partout. **Plus de majuscules à tracking large.**
- Deux poids : 400 et 500 (600 rare). La hiérarchie vient de la taille et de
  la couleur, pas du poids.
- Petits textes : jamais de tracking négatif.

## Composants

### Cards
- Surface `--surface-1` ou `--surface-2`
- Hairline `--border-1` (ou `--border-2` pour une carte active)
- Radius 12 px (panneaux 16), radius imbriqué = extérieur − padding
- Hover : changement de bordure/fond, aucun `scale`, aucun glow

### Boutons
- Primaire : fond ambre, texte `#17110a`, radius 8, hauteur 44
- Secondaire : hairline, texte `--text-1`
- Press : `scale(0.98)`, 120 ms

### Inputs
- Fond `--surface-1`, hairline `--border-2`
- Focus : anneau `--accent` 2 px, offset 2 (jamais de glow)

### Sidebar / panneaux
- Panneaux pleins, séparés par une hairline verticale
- Rail desktop 68 px, panneau de contexte 340 px repliable
- Mobile : barre supérieure + bottom nav, contenu empilé

## Layout

- Desktop : rail icônes (68 px) · contenu fluide · panneau de contexte (340 px)
- Les applications remplissent le viewport, pas de colonne centrée étroite
- Espacement sur la grille de 4 px ; navigation 32–36 px de haut
- `/chat` accueil : composition ancrée en haut, badge détaillé au bord supérieur

## Motion

- Une seule courbe : `cubic-bezier(.22, 1, .36, 1)` (`--ease`)
- Durées : 120 ms (press), 150–200 ms (couleur), 300–620 ms (entrée)
- Animations nommées uniquement (`transition-colors`, `transition-[transform,opacity]`)
- Aucun mouvement en boucle décoratif : pas de shimmer de titre, pas de halo,
  pas de balancement, pas de particules. Restent autorisés : spinner de
  chargement, curseur qui clignote (l'IA attend), point « en cours ».
- Une seule entrée au chargement, courte (fade + 6–12 px), petit échelonnement.

## Console IA

L'ancienne « exception assumée » (dégradés radiaux, halos, sheen, particules)
est **supprimée**. L'accueil du chat garde :

- le badge logo détaillé (`/backstage-logo.png`), ancré au bord supérieur
- la salutation en Instrument Serif
- la fiche du prochain rendez-vous (donnée réelle, filet ambre 2 px)
- les puces de contexte et 4 raccourcis

Le panneau de flux reste une ligne de temps unique (cours + agenda + rappels)
groupée par jour, avec un bloc « En retard » plafonné à 4 entrées.

## Kanban (photos)

- Colonnes séparées par des hairlines
- En-têtes de colonne en mono, casse normale
- Cartes : métadonnées minimales (artiste, salle, date)
- Bouton d'ajout : bordure pointillée centrée

## LeetCode

- Deux colonnes sur desktop : jauge de série à gauche, éditeur + réponse à droite
- Réponse : surface, barre de titre, point ambre et libellé « Réponse »

## Accessibilité

- Focus visible `outline: 2px solid var(--accent); outline-offset: 2px`
- Contraste minimum 4.5:1 pour le texte principal et le texte sur ambre
- `prefers-reduced-motion` neutralise toutes les animations (`app/globals.css`)
