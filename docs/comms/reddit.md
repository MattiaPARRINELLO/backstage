# Com : lancement Reddit

Objectif : trouver les 10 à 15 premiers utilisateurs et récolter des demandes de
modules avant même l'ouverture des comptes.

Positionnement à tenir partout :

- Backstage réunit mails, agenda, rappels, notes et une IA qui s'en souvient.
- Le socle est générique, les modules (photos, concerts, LeetCode, etc.)
  s'activent au cas par cas.
- BYOK : chacun apporte ses propres clés, aucun coût de tokens pour l'hôte.
- Gratuit, capacité volontairement limitée à 10-15 comptes pour l'instant.
- Ce n'est pas un lancement : c'est un chantier en cours, on cherche des avis.

Ne pas promettre : inscription ouverte, récupération de compte, application
mobile multi-comptes, CESAR pour les autres.

---

## 1. Avant de poster (checklist)

- [ ] La démo publique répond et ne tombe pas au premier pic.
- [ ] La landing affiche la section « Comptes » et sa capacité.
- [ ] Le lien de la roadmap pointe vers une branche poussée sur GitHub.
- [ ] Un GIF de 10 à 20 secondes montre une question et la réponse qui relie
      agenda + mail + note.
- [ ] Deux ou trois captures propres : chat, mémoire éditable, panneau du jour.
- [ ] Le README explique l'installation en une commande.
- [ ] Une réponse préparée à « c'est quoi la différence avec Notion / Obsidian /
      ChatGPT ? » (contexte local + mémoire + actions confirmées).
- [ ] Une réponse préparée à « pourquoi pas de Postgres ? » (10-15 comptes,
      fichiers JSON, migration prévue derrière une interface de stockage).

---

## 2. r/SideProject (anglais) : le post principal

Titre :

> I built a personal second brain for myself. Now I'm turning it into a
> multi-user app where everyone brings their own API keys.

Corps :

> For the past year I've been using a personal web app I built for myself. It
> pulls together my email, calendar, reminders, notes and photos, and an AI that
> actually remembers what I told it, because the context lives in my own files,
> not in a chat history.
>
> It works well. Too well to keep it to myself.
>
> So I'm turning it into a real product, with three constraints:
>
> - **Bring your own keys.** You plug in your own AI key, your own Google or
>   Microsoft OAuth app, your own weather key. I don't pay for your tokens, and
>   I never see your keys in clear.
> - **A small core, optional modules.** The core is chat, memory, reminders,
>   calendar and email. Photos, concerts, LeetCode and other modules are off by
>   default and you enable what you actually need.
> - **Small on purpose.** 10 to 15 accounts for now, free. Not because I'm
>   generous, because JSON files per account are enough at that size and I'd
>   rather ship than build infrastructure I don't need.
>
> The honest part: it's still single-user today. Accounts, data isolation,
> encrypted key storage and a module registry are on a branch, in progress.
>
> What I'd love from you: what would the *one* module you'd turn on first be?
> I'd rather build the next three modules from real requests than guess.
>
> Demo (fake data, no account): [link]
> Code (MIT): [link]
> Roadmap: [link]

Notes : r/SideProject accepte les posts produit avec lien. Poster en semaine,
éviter le week-end. Répondre à chaque commentaire dans l'heure.

---

## 3. r/selfhosted (anglais) : l'angle souveraineté

Titre :

> I'm making my self-hosted personal assistant multi-user, with per-account
> encryption for API keys. What would you want to self-host differently?

Corps :

> Backstage is a self-hosted personal space: chat, memory, reminders, calendar,
> email, photos, all in a folder of JSON files you own. MIT, no SaaS dependency.
>
> Today it's designed for one person. I'm opening it to a handful of users, and
> the design questions are the interesting part:
>
> - Keys are encrypted at rest with a master key that stays outside the data
>   folder, so a stolen backup doesn't leak API keys.
> - Each account gets its own directory, own OAuth tokens, own push devices.
> - Modules are opt-in. The core is generic, everything personal is a flag.
> - No database for now. Files plus atomic writes, because 15 users don't
>   justify Postgres. The storage layer is behind an interface so it can change.
>
> If you run something similar for family or friends, I'd like your feedback on
> two things: how do you handle account recovery without email, and what do you
> do when one user's cron job starts failing silently?
>
> Demo: [link] · Code: [link] · Roadmap: [link]

Attention : r/selfhosted est strict sur l'auto-promotion. Lire les règles du
jour, privilégier le flair Discussion ou le fil hebdomadaire de showcase, ne pas
reposter la même chose dans plusieurs fils.

---

## 4. r/devfrance (français) : l'angle retour d'expérience

Titre :

> Je passe mon app perso mono-utilisateur en multi-comptes avec BYOK. Ce que
> j'aurais aimé savoir avant.

Corps :

> Backstage, c'est une app Next.js que j'utilise tous les jours : chat, mémoire,
> rappels, agenda, mails, et quelques modules perso (photos de concert,
> LeetCode). Tout vit dans un dossier `data/` en JSON, auth par passkey, zéro
> base de données.
>
> Je l'ouvre à 10-15 personnes. Le vrai travail n'est pas l'interface, c'est
> l'isolation :
>
> - `createSession("owner")` était en dur dans quatre routes. Un seul `userId`
>   pour toute l'app.
> - 29 fichiers écrivaient dans `data/` sans notion de scope.
> - Les tokens OAuth, les appareils push et le cache de modèles étaient
>   globaux.
> - La clé IA était lue depuis `process.env` au chargement du module.
>
> Ce que je fais : un dossier par compte, un helper unique de résolution de
> chemin, un coffre chiffré AES-GCM pour les clés, un registre de modules avec
> activation par compte, et un test d'isolation par domaine.
>
> Décision assumée : pas de Postgres. À 15 comptes, des fichiers suffisent, et
> je préfère garder la migration derrière une interface de stockage.
>
> Si vous avez déjà fait ce passage mono vers multi, je prends les pièges.

Notes : pas de lien produit dans le corps, le mettre en commentaire si on te le
demande. Le sub est plus réactif sur les retours techniques que sur la promo.

---

## 5. Un post technique (optionnel, r/nextjs ou r/webdev)

Titre :

> Single-tenant to multi-tenant in a JSON-file app: scoping 29 files without a
> database

Angle : montrer le pattern de scope, le test d'isolation, et la décision de ne
pas migrer vers Postgres tout de suite. Poster seulement après la Phase 2, avec
du code réel et des chiffres. C'est le post qui ramène des gens techniques, donc
les futurs contributeurs.

---

## 6. Calendrier

| Moment | Action |
| --- | --- |
| J0 | r/SideProject (post principal, version anglaise) |
| J0 + 2 h | Répondre à tous les commentaires, demander le module prioritaire |
| J+2 | r/devfrance (retour d'expérience) |
| J+4 | r/selfhosted (discussion, pas promo) |
| J+7 | Récapitulatif : les modules demandés, ce qui est retenu |
| Ouverture | Show HN + post de lancement, une fois les 10-15 comptes prêts |

Une seule publication par sub et par semaine. Répondre vaut plus que poster :
c'est dans les commentaires que se trouvent les demandes de modules.

---

## 7. Ce qu'on mesure

- Nombre de demandes de module distinctes, classées par fréquence.
- Nombre de personnes qui demandent un accès.
- Questions récurrentes (prix, sécurité des clés, récupération de compte).
- Les trois modules à construire en premier, choisis sur les demandes réelles.

Ces demandes deviennent la Phase 9 : « modules issus des retours ».
