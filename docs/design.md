# Design — Backstage

> État au 2 novembre 2026, après réconciliation des cinq branches de refonte.
> **La landing et l'application partagent le même langage.** Ce fichier décrit
> ce qui est réellement dans `app/globals.css` et `app/landing.css` ; en cas de
> doute, c'est le CSS qui tranche, puis ce document doit être corrigé.

---

## 1. Le principe

Un espace personnel qui se lit comme un **outil de travail**, pas comme un site.
Le contenu porte la richesse ; le chrome reste silencieux : surfaces, espace,
un seul accent.

Deux règles qui décident de tout le reste :

1. **Un seul accent.** Le bleu `#2547ff` signale l'action, la sélection et la
   donnée qui compte. Le rouge est réservé à l'urgence et aux retards, l'ambre
   à l'avertissement. Rien d'autre n'est coloré.
2. **Aucune décoration.** Pas de dégradé décoratif, pas de halo, pas de trame,
   pas de particule, pas d'ombre portée sauf sur une surface qui flotte
   réellement (panneau de contexte, menu mobile, dialogue, toast). La profondeur
   vient des paliers de surface et des filets.

---

## 2. Couleurs

Le thème est porté par `<html data-theme="light|dark">`. Le script bloquant de
`app/layout.tsx` le pose avant la première peinture : `prefers-color-scheme`,
sauf `localStorage["pb-theme"]`.

**Défauts** : la landing suit le système ; l'application démarre en **sombre**
si aucun choix n'est enregistré.

### Thème sombre (`:root`, vrai par défaut de l'app)

| Token | Valeur | Usage |
| --- | --- | --- |
| `--background` | `#0a0b0d` | fond de page |
| `--surface-1` | `#14161a` | cartes, panneaux |
| `--surface-2` | `#101215` | champs, sections creuses |
| `--surface-3` | `#1b1e24` | survol, palier le plus haut |
| `--border-1` / `--line` | `rgba(242,244,248,.08)` | filets, bordures de carte |
| `--border-2` / `--line-2` | `rgba(242,244,248,.14)` | contour au survol |
| `--border-3` | `rgba(242,244,248,.22)` | contour actif |
| `--text-1` / `--foreground` | `#f2f4f8` | texte principal, titres |
| `--text-2` | `#b7bcc6` | texte courant |
| `--text-3` | `#9aa0ab` | notes, étiquettes, libellés |
| `--text-4` | `#7d838f` | texte le plus ténu (placeholders, légendes) |
| `--accent` | `#7d94ff` | accent, action primaire (éclairci pour tenir AA) |
| `--accent-soft` | `#a9b8ff` | accent secondaire de texte (code inline) |
| `--success` | `#9bbf8a` | série tenue, envoi réussi |
| `--danger` | `#d98878` | en retard, échec, suppression |
| `--warning` | `#e0a45e` | avertissement (cf. ci-dessous) |

### Thème clair (`html[data-theme="light"]`)

| Token | Valeur |
| --- | --- |
| `--background` | `#f7f8fa` |
| `--surface-1` | `#ffffff` |
| `--surface-2` | `#f1f3f7` |
| `--surface-3` | `#e9ecf3` |
| `--border-1` / `--border-2` / `--border-3` | `#e6e9ef` / `#d8dce4` / `#c4cad6` |
| `--text-1` … `--text-4` | `#0a0b0d` / `#545a66` / `#6b7280` / `#8b919c` |
| `--accent` / `--accent-soft` | `#2547ff` / `#5c74ff` |
| `--success` / `--danger` / `--warning` | `#3f7a4f` / `#b42318` / `#b4530f` |

### Le sort de l'ambre — décision

L'ancienne direction avait `--accent: #e0a45e` (ambre) et plusieurs alias
(`--warm`, `--accent-warm`, `--accent-cool`, `--violet-deep`, `--ai-thinking`,
`--ai-tool-call`). **Tous ces alias sont supprimés.** L'ambre ne survit que sous
le nom `--warning`, avec une sémantique unique :

- bandeau hors-ligne et bannière « mise à jour disponible » ;
- connexion Google expirée ou à reconnecter ;
- difficulté « moyenne » sur LeetCode ;
- icône de mise en garde dans un test de brief.

Il n'est jamais un second accent, jamais une décoration, jamais un état neutre.
Un badge de workflow (ex. « Trié », « Exporté ») utilise `--text-3`, pas l'ambre.

### Plaques (surfaces inversées)

Une carte peut s'inverser : plaque sombre sur page claire, plaque claire sur
page sombre. C'est le « écran dans la page ».

| Token | Sombre | Clair |
| --- | --- | --- |
| `--plate-bg` | `#f4f6fa` | `#0a0b0d` |
| `--plate-ink` | `#0a0b0d` | `#f2f4f8` |
| `--plate-2` | `#3a3f4a` | `#cbcfd8` |
| `--plate-3` | `#6b7280` | `#7d838f` |
| `--plate-line` | `rgba(10,11,13,.10)` | `rgba(242,244,248,.12)` |
| `--plate-acc-bg` | `#e9eeff` | `rgba(37,71,255,.14)` |
| `--plate-acc-ink` | `#1b34c4` | `#b9c6ff` |

### Exceptions assumées (ne pas « corriger »)

- **Graphe de connaissances** (`components/brain/KnowledgeGraph.tsx`) : quatre
  catégories ont besoin de quatre teintes distinctes. Elles sont mappées sur
  les tokens système (`--accent`, `--warning`, `--success`, `--danger`) —
  aucune valeur nouvelle, mais quatre couleurs simultanées.
- **Couleurs d'événements Google** (`app/calendar/calendar-utils.ts`) : ce sont
  les identifiants officiels de l'API Calendar, pas une palette de design.
- **Presets d'accent** (`components/ui/ThemeApplier.tsx`) : ce sont des valeurs
  choisies par l'utilisateur, stockées dans `localStorage["brain-accent"]`.
  Elles remplacent `--accent` ; il n'y a jamais deux accents en même temps.
  `themeColor` dans `app/layout.tsx` est une métadonnée : elle ne peut pas
  recevoir de `var()`.

---

## 3. Typographie

| Rôle | Police | Réglage |
| --- | --- | --- |
| Titres, noms de blocs, chiffres forts | **Space Grotesk** (`--font-display`) | 600, `letter-spacing: -0.03em` à `-0.045em`, `line-height: 0.96–1.05` |
| Texte, interface | **Inter** (`--font-sans`) | 400/500, `line-height: 1.5–1.6` |
| Étiquettes, heures, montants, code | **JetBrains Mono** via `.ui-mono` | 400, `font-variant-numeric: tabular-nums` |
| Éditorial (login uniquement) | Instrument Serif (`--font-editorial`) | 400 — **ne pas étendre** |

### Échelle — cinq tailles visibles maximum

| Token | Valeur | Usage |
| --- | --- | --- |
| `--t-display` | `clamp(2.35rem, 4.8vw, 4.25rem)` | titre de premier écran (landing) |
| `--t-head` | `clamp(1.75rem, 3vw, 2.75rem)` | titre de page |
| `--t-lead` | `clamp(1.125rem, 1.3vw, 1.375rem)` | chapô, sous-titre, chiffre secondaire |
| `--t-body` | `1.03125rem` (16,5 px) | texte courant, réponse du chat |
| `--t-small` | `0.8125rem` (13 px) | notes, étiquettes, libellés, monnaie |

Règles :

- **Jamais de texte lisible sous 13 px.** Toute la base a été ramenée au
  plancher : plus un seul `text-[10px]` / `text-[11px]` / `text-xs` dans
  `app/` et `components/` (hors landing, qui a sa propre échelle).
- Un titre tient en **deux lignes** à toutes les largeurs.
- Les paragraphes courent sur **45 à 75 caractères** (`max-width: 34rem`).
- Pas de majuscules espacées en étiquette : casse normale, 13 px, `--text-3`.
- Pas d'italique dans les titres.

---

## 4. Espace, formes, profondeur

| Token | Valeur |
| --- | --- |
| `--r-card` | `26px` |
| `--r-tile` | `18px` |
| `--r-sm` | `12px` |
| pastille (bouton, puce, champ) | `999px` |
| gouttière de grille | `8–10px` |
| marge de page | `20 → 28 → 40px`, conteneur `1320px` |
| `--shadow-float` | `0 40px 90px -50px rgba(0,0,0,.55)` (sombre) |

- **Une seule paire de marges** par page, conteneur centré.
- **Rythme vertical variable** : `88px` (dense), `104px` (courant), `152px`
  (respiration). Une page où toutes les sections ont le même padding est plate.
- **Une ombre**, réservée aux surfaces qui flottent. Jamais sur une carte posée.
- Bordures : `1px solid var(--line)` pour une carte ; pas de bordure quand le
  palier de surface suffit.
- **Rayons** : `--r-card` pour une surface de page (panneau, dialogue, carte
  principale), `--r-tile` pour une tuile ou un bloc secondaire, `--r-sm` pour
  une ligne, un champ de recherche, un bloc de code. Les rayons Tailwind
  (`rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`) ne sont plus utilisés
  dans l'application.

### Composition

- Une section = un titre qui la nomme, puis son contenu. **Pas d'étiquette
  au-dessus du titre.**
- Les grilles de boîtes identiques sont interdites : varier les largeurs, ou
  remplacer la carte par une fiche technique à filets.
- Une colonne ne reste jamais vide.

---

## 5. Composants

Les primitives vivent dans `app/globals.css`, dans `@layer components`. Elles
sont **la seule définition** d'un bouton, d'une carte, d'une puce ou d'un
champ. Les composants React (`components/ui/Button.tsx`, `Card.tsx`,
`Input.tsx`, `Pill.tsx`, `IconButton.tsx`) ne font que traduire une API en
classes — ils n'inventent ni couleur ni rayon. Comme les primitives sont dans
`components`, une classe utilitaire Tailwind peut les surcharger sans `!`.

| Classe | Rôle | Variantes |
| --- | --- | --- |
| `.ui-card` | carte de page : `--surface-1`, `1px --line`, `--r-card` | — |
| `.ui-tile` | tuile : `--surface-1`, `1px --line`, `--r-tile` | — |
| `.ui-plate` | plaque inversée (`--plate-*`) | seule surface à porter `--shadow-float` |
| `.ui-btn` | bouton, pastille, hauteur 44 px | `--primary`, `--ghost`, `--quiet`, `--danger`, `--text` ; tailles `--sm` (36), `--xs` (28), `--icon`, `--block` |
| `.ui-chip` | puce : pastille, `1px --line`, 13 px | `[data-active="true"]` (aplat accent), `--tile` (puce large de sélection) |
| `.ui-field` | champ : `--surface-2`, pastille, 44 px | `--area` (multiligne), `--boxed` (`--r-sm`) |
| `.ui-label` | étiquette de donnée : 13 px, `--text-3` | — |
| `.ui-mono` | mono tabulaire 13 px | — |

Règles d'état :

- `:focus-visible` sur bouton, puce et champ : `outline 2px var(--accent)`,
  `offset 3px`.
- `:disabled` : `opacity .55`, curseur interdit.
- Un contrôle répond au survol, au focus clavier et au press. Un élément non
  cliquable n'a pas d'état de survol.

### Correspondance avec les composants React

| Composant | Rendu |
| --- | --- |
| `Button` | `.ui-btn` + variante ; `size="md"` = `--sm` (barres d'outils), `lg` = 44 px, `icon` = carré |
| `IconButton` | `.ui-btn` + `--icon` + `--xs`/`--sm` ; `label` obligatoire (aria-label + title) |
| `Card` | `.ui-card` ; `elevated` = `--surface-2`, `ghost` = transparent |
| `Input` / `Textarea` / `Field` | `.ui-field` (+ `--area` pour le textarea), libellé en `.ui-label` |
| `Pill` | `.ui-chip` + teinte (`accent`, `warning`, `success`, `danger`, neutre) |

Icônes : **Lucide uniquement**, `strokeWidth 1.5–1.6`. Les seuls `<svg>` écrits
à la main sont structurels (arc du login, graphe de connaissances, jauge de
série) — jamais une icône.

---

## 6. Mouvement

- **Deux mouvements, pas trente.** Une entrée orchestrée à l'ouverture et une
  dérive lente des images au défilement. Le reste est posé : **aucune animation
  d'apparition par section.**
- Courbe unique `--ease: cubic-bezier(.22,1,.36,1)`. Durées : 120 ms (press),
  150–200 ms (couleur), 600–900 ms (entrée).
- `transform` et `opacity` uniquement.
- `prefers-reduced-motion` réduit tout à un état terminal.

Ce qui reste dans le CSS :

| Classe | Usage |
| --- | --- |
| `.flux-enter` | changement de vue du panneau de contexte |
| `.context-view-enter` | bascule de vue contextuelle (outil IA en cours) |
| `.chat-stagger` | entrée échelonnée des blocs de conversation |
| `.fade-in`, `.fade-in-up`, `.slide-up`, `.scale-in` | entrée d'un bloc |
| `.fade-in-action-chips` | apparition des puces d'action d'un message |
| `.toast-slide-in` | toast |
| `.thinking-dot`, `.pulse-dot`, `.blink-cursor` | indicateurs d'activité |
| `.login-load`, `.login-ring`, `.login-progress-arc`, `.login-fingerprint`, `.login-check` | séquence passkey du login |
| `.home-rise`, `.home-swap`, `.home-caret` | accueil du chat (salutation, changement de texte, curseur) |

Supprimés lors de la réconciliation : halos radiaux, trame et particules de
l'accueil, balayages (`sheen`), pendule du badge, animations orbitales, anneaux
et explosion du login, `shimmer`, `tool-scan`, `breathe`, `fade-out-up`,
`transition-height`, `home-ambience`, `panel-sheen`, `flux-now`.

---

## 7. Deux implémentations, un seul langage

| Fichier | Portée |
| --- | --- |
| `app/globals.css` | tokens, base, primitives `.ui-*`, animations de l'application |
| `app/landing.css` | tokens et composants **de la landing**, isolés sous `.landing-page` |

La landing garde ses classes (`.card`, `.plate`, `.btn`, `.chip`…) et ses
tokens propres : elle ne consomme pas les `.ui-*` de l'application. Les valeurs
sont les mêmes ; toute évolution de palette doit être répercutée dans les deux
fichiers, puis ici.

Landing = `components/landing/*`, un composant par section, contenu éditorial
centralisé dans `app/landing-content.ts`.

---

## 8. Ce qui reste ouvert

1. **Bascule de thème dans l'application.** Le seul bouton clair/sombre est sur
   la landing (`components/landing/ThemeToggle.tsx`). Dans l'app, le thème suit
   `localStorage["pb-theme"]` mais aucun contrôle ne le change : un utilisateur
   qui n'a jamais touché la landing reste en sombre. Ajouter un contrôle dans
   `/settings > Apparence` demanderait une décision produit.
2. **Plaque.** Une seule utilisation réelle (`HomeHero`, prochain rendez-vous).
   Le langage prévoit qu'elle reste rare : c'est ce qui la rend lisible.
3. **Instrument Serif.** Toléré sur le login seulement. Si un jour il disparaît,
   supprimer aussi `--font-editorial` et l'import dans `app/layout.tsx`.
4. **Graphiques.** Le graphe de connaissances est le dernier endroit qui affiche
   plusieurs teintes simultanées ; sa palette est documentée en §2.
5. **Largeur du kanban Photos.** Six colonnes ne tiennent pas à 1440 px : la vue
   défile horizontalement, c'est voulu, mais aucune indication de défilement
   n'est affichée à la souris.

---

## 9. Accessibilité

- Contraste minimum 4,5:1 pour le texte, 3:1 pour les éléments d'interface.
- Focus visible partout : `outline: 2px solid var(--accent); outline-offset: 3px`.
- Tout contrôle a un nom accessible ; les icônes seules ont un `aria-label`.
- Une seule `h1` par page ; chaque section a un titre qui la nomme.
- Les libellés de formulaire sont visibles (ou `sr-only` si le contexte suffit),
  et les erreurs sont annoncées (`role="alert"`).
- **Raccourci d'envoi du chat** : `Ctrl/Cmd+Entrée` envoie, `Entrée` va à la
  ligne (sur écran tactile, `Entrée` envoie). Le rappel sous le composer dit
  exactement cela.
