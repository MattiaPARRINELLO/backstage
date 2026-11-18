# Utilisation et conception

Contenu déplacé du README : ce que fait l'application, ses écrans, et les
décisions techniques qui expliquent sa forme. Rien n'a été supprimé.

## Ce que c'est

BACKSTAGE n'est pas un dashboard de plus. C'est un espace de travail unique où
l'IA conversationnelle, la mémoire persistante et les outils du quotidien
(Gmail, Calendar, LeetCode, concerts) se répondent entre eux.

- **Chat IA streaming** (OpenAI / Anthropic) avec raisonnement visible, appels
  d'outils en direct
- **Mémoire** : l'IA se souvient de faits, et tu peux les corriger, oublier,
  explorer
- **Rappels** natifs navigateur + brief quotidien automatique
- **Watch-later** : liens, articles, vidéos YouTube avec extraction d'aperçu
  (og:image)
- **Agenda & Mail** : intégration Google via OAuth
- **Accréditations** : gestion des accréditations photo concerts (suit mes
  shootings)
- **Recherche web** : Brave Search avec fallback DuckDuckGo (outils IA du chat)
- **PWA** : installable, fonctionne hors-ligne, service worker, manifest
- **Thèmes & accent** : clair ou sombre (suit le système, choix mémorisé),
  couleur d'accent réglable dans les paramètres

## Stack

| **Frontend** | **Runtime & données** | **Intégrations** |
| --- | --- | --- |
| Next.js | Bun | OpenAI |
| React 19 | TypeScript | Anthropic |
| Tailwind CSS | Vitest | Google OAuth |
| react-markdown | google-auth-library | Passkey (WebAuthn) |

Bun pour le développement et le build ; le conteneur de production exécute le
build standalone sur Node 22.

## Les écrans

Toutes ces pages sont privées (passkey) sauf la landing et la connexion.

| Route | Ce qu'elle fait |
| --- | --- |
| `/` | Landing publique : ce que fait le produit, la démo et l'installation en une commande |
| `/login` | Connexion par passkey (Face ID / Touch ID / clé de sécurité), aucune saisie de mot de passe |
| `/chat` | Le cœur : conversation IA en streaming, mémoire, outils, pièces jointes et panneau de contexte |
| `/today` | La journée : rappels, agenda, cours et relances du jour réunis |
| `/week` | La semaine : charge de travail en colonnes, avec les événements et les retards |
| `/focus` | Un minuteur de séance, avec les rappels mis en pause pendant le travail |
| `/photos` | Kanban des shootings photo et vue « Livraison » (galerie par état) |
| `/brain` | La mémoire de l'IA : faits éditables, catégories, filtres et graphe de relations |
| `/m/watch-later` | Liens, articles et vidéos à garder, avec aperçu et réorganisation (`/watch-later` redirige) |
| `/calendar` | Agenda Google en grille mensuelle, création et édition d'événements |
| `/reminders` | Rappels groupés par échéance, récurrence et synchronisation Microsoft To Do |
| `/gmail` | Boîte de réception résumée, lecture et envoi de mails |
| `/leetcode` | Progression LeetCode : série, activité, difficulté et rang |
| `/schedule` | Emploi du temps CESAR (semaine + synchronisation) |
| `/settings` | Modèles IA, accent, connexions Google/Microsoft, export et compte |
| `/search` | Recherche unifiée dans la mémoire, les mails, les rappels et le web |
| `/activity` | Journal d'activité de l'application et des actions de l'IA |
| `/demo-calls` | Console privée des appels de la démo publique (audit) |
| `/privacy` | Politique de confidentialité et portabilité des données |
| `/offline` | Page de repli servie par le service worker hors-ligne |

## Décisions techniques notables

1. **Next.js 16 App Router + React 19** — Server Actions pour la mémoire et les
   rappels, Server Components pour les vues, streaming IA via Route Handler SSE.
2. **`googleapis` → `google-auth-library`** — moins de surface, plus de contrôle
   sur les tokens et le refresh.
3. **Cache client TTL + stale-while-revalidate** — pas de re-fetch agressif,
   données toujours fraîches sous 60s.
4. **Service Worker maison** — pas de Workbox, stratégie `cache-first` pour le
   shell, `network-first` pour les API.
5. **Manifeste + icônes PNG déclinées** — service worker maison, installable sur
   iOS et Android sans dépendre d'un générateur.
6. **Pas de base de données** — pour l'instant, fichiers JSON + mémoire serveur.
   C'est personnel, c'est assumé.

> Un bon outil personnel, c'est un outil qu'on peut ouvrir à 2h du matin
> sans se demander si la dépendance de gauche va casser.

## Trois problèmes réels, et ce qu'ils m'ont appris

Ce sont les bugs qui m'ont le plus coûté de temps — donc les plus instructifs.

**1. Un bundle edge qui embarquait le système de fichiers.**
Mon proxy d'authentification plantait au démarrage en production avec
`__import_unsupported is not defined`. La cause : un import **statique** de
`dotenv` dans `instrumentation.ts`, qui embarque `fs`, `path`, `os` et
`crypto` dans le bundle edge — alors qu'un runtime edge n'a pas de système
de fichiers. Corrigé par des imports dynamiques gardés par une condition
`NEXT_RUNTIME === "nodejs"`.
*Ce que j'en retiens : sur un runtime edge, ce que tu importes statiquement
finit dans le bundle, même si tu ne l'exécutes jamais.*

**2. Playwright fonctionnait en local, mort en production.**
La synchro de l'emploi du temps passait au green sur ma machine et plantait
une fois déployé. L'hébergement de prod est un cPanel en `--production`,
sans Chromium : toute solution Playwright y était condamnée. J'ai réécrit le
scraping en `fetch` HTTP pur (CSRF → login → skip CVEC → décodage JSON de
l'attribut HTML).
*Ce que j'en retiens : le meilleur test, c'est d'essayer sur la production
avant d'y déployer.*

**3. Une API qui répond HTTP 200 en échouant.**
Mes compteurs LeetCode affichaient quatre zéros. Trois erreurs distinctes :
les compteurs ne sont pas sur `/{pseudo}` (mais sur `/{pseudo}/solved`), un
pseudo inconnu répond **200** avec un tableau `errors` dans le corps, et
`ranking: 5000001` signifie « non classé », pas un numéro.
*Ce que j'en retiens : HTTP 200 ne veut pas dire succès, et un champ bien
nommé ne signifie pas ce qu'on croit.*

## Contribuer

Les contributions externes sont bienvenues : corrections de bugs, tests,
documentation, accessibilité et auto-hébergement. Les PR restent petites (un
sujet, moins de 400 lignes) et déclarent l'aide éventuelle d'un assistant IA.

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) : installation, commandes,
  conventions de branche et de commit, périmètre, transparence IA
- [`code-map.md`](contributing/code-map.md) : quel dossier fait
  quoi, où ajouter une route, une action, un écran, un test
- [`premiere-pr.md`](contributing/premiere-pr.md) : ta première PR
  en 15 minutes
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) : règles de comportement

Les issues utilisent les modèles de `.github/ISSUE_TEMPLATE/`. Pour une faille
de sécurité, écris à [contact.mprnl@gmail.com](mailto:contact.mprnl@gmail.com)
au lieu d'ouvrir une issue publique.
