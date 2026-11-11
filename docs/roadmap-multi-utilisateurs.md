# Roadmap : comptes multiples et BYOK

Statut : **en cours de développement**, branche `feat/multi-utilisateurs-byok`.
Objectif : passer d'une application mono-utilisateur auto-hébergée à un service
public où chaque personne crée son compte, apporte ses propres clés API et
retrouve un espace personnel isolé.

Cible immédiate : **10 à 15 utilisateurs**, gratuit, une seule instance Node.
Contrainte assumée : stockage JSON par utilisateur, pas de base de données.
Migration vers Postgres possible plus tard sans changer les contrats de haut
niveau (voir § Migration future).

---

## 1. Décisions actées

| Sujet | Décision | Raison |
| --- | --- | --- |
| Stockage | Un dossier `data/users/<userId>/` par compte | Volume faible, zéro infra, réversible |
| Base de données | Aucune pour la v1 | 10 à 15 comptes tiennent largement en fichiers |
| Authentification | Passkey (WebAuthn) par compte + code de secours | Pas de mot de passe, cohérent avec l'existant |
| Récupération | Code de secours à usage unique + email optionnel | Une passkey perdue ne doit pas détruire le compte |
| Clés IA | BYOK obligatoire, clé fournie par l'utilisateur | Aucun coût de tokens pour l'hébergeur |
| Chiffrement des clés | AES-256-GCM au repos, master key en variable d'env | Une fuite du dossier `data/` ne livre pas les clés |
| Instance self-host | Conservée, mode mono-utilisateur | Ne pas casser l'usage actuel |
| Inscription | Ouverte mais limitée par une liste d'attente / capacité | Éviter l'abus pendant la phase gratuite |
| Facturation | Hors périmètre v1 | À traiter quand la capacité devra grandir |

### Ce que "clé" recouvre

L'utilisateur devra fournir lui-même, selon ce qu'il active :

- **IA** : `baseURL` compatible OpenAI ou Anthropic + clé + modèles choisis.
- **Google** : client ID / secret OAuth pour Calendar et Gmail.
- **Microsoft** : client ID / secret OAuth pour Microsoft To Do.
- **OpenWeatherMap** : clé météo du brief quotidien.
- **Brave Search** : clé de recherche web (optionnelle, sinon DuckDuckGo).
- **CESAR** : identifiant et mot de passe de l'emploi du temps (optionnel).

Chaque intégration doit pouvoir être **désactivée** proprement si la clé manque,
sans faire échouer le reste de l'application.

---

## 2. Architecture cible

```
data/
  instance.json              # config globale de l'instance (mode, capacite)
  .setup-consumed            # conserve pour l'instance self-host
  users/
    <userId>/
      account.json           # profil, etat, dates, code de secours (hash)
      passkeys.json          # credentials WebAuthn du compte
      secrets.enc.json       # coffre chiffre (cles IA, OAuth, meteo, brave, cesar)
      config.json            # modeles, preferences, theme, features
      reminders.json
      chat-history.json
      memory.json
      calendar.json
      emails.json
      gallery.json
      ...
  backups/
    <userId>/...
```

Principes :

1. `userId` est opaque (ULID ou UUID v4), jamais l'email.
2. Le chemin est **toujours** dérivé de la session, jamais d'un paramètre client.
3. Un helper unique `userPath(userId, filename)` remplace les chemins globaux.
4. Le code de stockage ne reçoit plus `filename` seul : il reçoit un scope.
5. `data/users/<id>/` est créé à l'inscription avec permissions `0700`.

---

## 3. Phases

### Phase 0 : cadrage et filet de sécurité (0,5 à 1 jour)

- [ ] Geler les contrats existants : lister chaque fonction de `lib/storage/*`
      qui écrit dans `data/` et son appelant.
- [ ] Inventorier les 29 fichiers qui touchent le FS (voir § Inventaire).
- [ ] Écrire un test de non-régression de l'instance mono-utilisateur existante.
- [ ] Créer la branche `feat/multi-utilisateurs-byok`.
- [ ] Documenter la stratégie de migration `data/*.json` vers
      `data/users/owner/*.json`.
- [ ] Décider du sort de `data/demo-calls.json` (global, pas par utilisateur).

**Sortie** : aucun code de production modifié, inventaire validé.

---

### Phase 1 : authentification multi-comptes (4 à 5 jours)

Le blocage actuel : `createSession("owner")` est codé en dur dans 4 routes et
`users.json` ne contient qu'une liste de passkeys sans notion de compte.

- [ ] Créer `lib/accounts.ts` : type `Account`, CRUD, statut
      (`active`, `suspended`, `deleted`), date d'inscription, capacité.
- [ ] Créer `data/users/<id>/account.json` à l'inscription.
- [ ] Déplacer les passkeys dans `data/users/<id>/passkeys.json`.
- [ ] Réécrire `lib/auth.ts` pour travailler par compte au lieu d'un store global.
- [ ] `/api/auth/passkey/register-options` : exige un identifiant de compte ou
      un ticket d'inscription, plus de bootstrap unique.
- [ ] `/api/auth/passkey/register-verify` : crée le compte, la passkey, le
      dossier de données, ouvre la session.
- [ ] `/api/auth/passkey/auth-options` : renvoie les credentials du compte
      concerné, plus toute la liste.
- [ ] `/api/auth/passkey/auth-verify` : vérifie le credential et signe un JWT
      avec le vrai `userId`.
- [ ] Inscription publique : formulaire minimal (nom d'affichage, passkey),
      feature flag `SIGNUPS_OPEN`, capacité `MAX_ACCOUNTS` (15 par défaut).
- [ ] Code de secours : généré à l'inscription, affiché une fois, stocké haché
      (Argon2id ou bcrypt). Route de récupération qui permet d'enregistrer une
      nouvelle passkey.
- [ ] Déconnexion : invalider le cookie, garder la passkey.
- [ ] Garder `DEV_AUTH_BYPASS` et `AI_PROVIDER=mock` fonctionnels.
- [ ] Supprimer la notion de "bootstrap consommé" pour les instances
      multi-utilisateurs, la conserver pour le mode self-host.
- [ ] Tests : inscription, double inscription, passkey inconnue, code de secours,
      compte suspendu.

**Sortie** : deux navigateurs distincts obtiennent deux `userId` différents et
ne peuvent pas se connecter l'un à l'autre.

**Risques** : WebAuthn et sous-domaines, passkeys non portables entre appareils,
utilisateurs sans second appareil. Le code de secours est la parade obligatoire.

---

### Phase 2 : isolation des données (7 à 10 jours, le plus gros lot)

- [ ] Introduire un type `StorageScope = { userId: string }` dans
      `lib/storage-core.ts`.
- [ ] Ajouter un helper `resolveUserPath(userId, filename)` unique.
- [ ] Faire passer le scope à `readJsonSafe`, `writeJsonAtomic`, `mutateJson`,
      `readOrCreate`, `maybeBackup`, soit par argument explicite, soit via un
      contexte de requête (`AsyncLocalStorage`).
- [ ] Migrer les 15 modules de `lib/storage/*` un par un :
  - [ ] `accreditations.ts`
  - [ ] `activity.ts`
  - [ ] `calendar.ts`
  - [ ] `chat-history.ts`
  - [ ] `concerts.ts`
  - [ ] `demo-calls.ts` (décision : global ou par user)
  - [ ] `emails.ts`
  - [ ] `gallery.ts`
  - [ ] `intentions.ts`
  - [ ] `leetcode.ts`
  - [ ] `memory.ts`
  - [ ] `photo-shoots.ts`
  - [ ] `reminders.ts`
  - [ ] `schedule.ts`
  - [ ] `watch-later.ts`
- [ ] Migrer les modules racine qui écrivent aussi :
  - [ ] `lib/config.ts` (config par compte)
  - [ ] `lib/consent.ts`
  - [ ] `lib/daily-brief.ts` (etat des briefs envoyés)
  - [ ] `lib/focus.ts`
  - [ ] `lib/google-client.ts` (tokens OAuth par compte)
  - [ ] `lib/microsoft-client.ts`
  - [ ] `lib/notification-scheduler.ts`
  - [ ] `lib/push-subscriptions.ts`
  - [ ] `lib/fcm-devices.ts`
  - [ ] `lib/passkey-pairing.ts`
  - [ ] `lib/server-cache.ts` (clé de cache préfixée par `userId` si sensible)
- [ ] Toutes les Server Actions (`app/actions/*`) : passer le `userId` issu de
      `requireSession()` à chaque appel de stockage.
- [ ] Tous les Route Handlers (`app/api/*`) : même règle, aucune exception.
- [ ] Vérifier les crons : ils parcourent désormais tous les comptes actifs au
      lieu de traiter l'owner unique.
- [ ] Migrer les images de galerie (chemins et URLs) vers le dossier du compte.
- [ ] Ajouter un test d'isolation automatique : créer A et B, écrire chez A,
      vérifier que B ne voit rien pour chaque domaine.
- [ ] Backups : un sous-dossier par utilisateur, rotation indépendante.

**Sortie** : aucune fonction de stockage ne peut écrire hors du dossier du
compte courant. Zéro `path.join(process.cwd(), "data", <fichier>)` restant hors
du helper.

**Risque principal** : oublier un seul appel et provoquer une fuite de données.
Mitigation : interdire les chemins littéraux en revue, plus un test qui grep le
code source à la recherche de `"data"` concaténé hors du helper.

---

### Phase 3 : BYOK et coffre de clés (4 à 5 jours)

- [ ] Créer `lib/secrets.ts` : coffre par compte, AES-256-GCM, IV aléatoire par
      entrée, clé maître lue dans `SECRETS_MASTER_KEY`.
- [ ] Générer `SECRETS_MASTER_KEY` dans `scripts/setup.ts`, refuser le démarrage
      en production si absente alors que le multi-compte est actif.
- [ ] Route de rotation de clé maître (re-chiffrement de tous les coffres).
- [ ] `lib/ai-providers/config.ts` : résoudre la config depuis le coffre du
      compte, avec repli sur les variables d'environnement pour l'instance
      self-host.
- [ ] Cache de config par `userId` (le cache global actuel mélangerait les
      comptes).
- [ ] Interface Paramètres > Clés IA :
  - [ ] saisie `baseURL`, clé, choix du protocole
  - [ ] bouton "Tester la clé" qui appelle `GET /models`
  - [ ] affichage masqué (`sk-...abcd`), jamais la clé complète côté client
  - [ ] suppression / remplacement de la clé
- [ ] Interface Paramètres > Intégrations : Google, Microsoft, météo, Brave,
      CESAR, chacune activable indépendamment.
- [ ] OAuth par compte : le `state` transporte le `userId`, les tokens vont dans
      le coffre, plus dans `data/google-token.json`.
- [ ] Messages d'erreur explicites quand une clé manque : "Aucune clé IA
      configurée", "Google non connecté", sans casser l'écran.
- [ ] Tests : chiffrement/déchiffrement, mauvaise clé maître, clé corrompue,
      remplacement, absence de clé.
- [ ] Audit : aucune clé dans les logs, dans les erreurs remontées au client, ni
      dans `/api/export`.

**Sortie** : deux comptes avec deux clés IA différentes obtiennent des réponses
de leurs modèles respectifs, et le catalogue de modèles est propre à chaque clé.

---

### Phase 4 : espace compte et onboarding (3 à 4 jours)

- [ ] Page `/account` : profil, passkeys, code de secours, clés configurées,
      état des intégrations, consommation indicative.
- [ ] Onboarding en 3 étapes après inscription :
      1. créer sa passkey et noter son code de secours
      2. coller sa clé IA et choisir ses modèles
      3. lancer une première conversation de démonstration
- [ ] Suppression de compte : confirmation forte, suppression du dossier,
      purge des backups à J+30.
- [ ] Export des données du compte (JSON), sans secrets.
- [ ] Changement de modèle par défaut par compte.
- [ ] Page "Mon espace" vide par défaut (pas d'héritage des données de l'owner).
- [ ] Retirer ou neutraliser tous les libellés "accès privé" dans l'app.

**Sortie** : un nouvel inscrit arrive sur un espace vide, configure sa clé et
obtient une réponse IA sans intervention manuelle.

---

### Phase 5 : landing page et parcours public (2 à 3 jours)

- [ ] Section "Comptes et clés" sur la landing : annonce du chantier, branche,
      capacité gratuite 10 à 15 utilisateurs.
- [ ] CTA "Créer un compte" quand `SIGNUPS_OPEN=true`, sinon liste d'attente.
- [ ] `proxy.ts` : routes publiques explicites (`/`, `/signup`, `/login`,
      `/api/auth/*`, `/api/demo`, `/install.sh`, `/privacy`), tout le reste
      privé.
- [ ] La démo publique reste sans compte et sans clé.
- [ ] Mettre à jour `PUBLIC_DEMO.after.note` et `HERO.note`.
- [ ] Mentions légales et confidentialité adaptées à l'hébergement de données
      d'autrui.
- [ ] SEO, OpenGraph et metadata cohérents avec la nouvelle promesse.

**Sortie** : un visiteur peut comprendre l'offre, créer un compte et savoir
pourquoi la capacité est limitée.

---

### Phase 6 : exploitation, quotas et coûts (4 à 5 jours)

- [ ] Quotas par compte : nombre de conversations par jour, taille de mémoire,
      nombre d'images.
- [ ] Rate limit global par IP + par `userId` (aujourd'hui seul `/api/chat`
      l'est, et uniquement par IP probablement).
- [ ] Cron multi-comptes : brief quotidien, notifications, synchronisations,
      avec reprise sur erreur par compte.
- [ ] Backups : script de sauvegarde par compte, restauration testée.
- [ ] Monitoring minimal : nombre de comptes, erreurs IA, latence, taille disque.
- [ ] Journal d'activité par compte, sans secrets.
- [ ] Procédure de suspension d'un compte sans supprimer ses données.
- [ ] Documentation de déploiement mise à jour (Docker, capacité, variables).
- [ ] Décider où tourne le déploiement : un serveur unique, volume persistant,
      pas de scale horizontal.

**Sortie** : l'instance tient 15 comptes actifs sans dégradation visible, et une
panne d'un compte n'affecte pas les autres.

---

### Phase 7 : sécurité et conformité (3 à 4 jours)

- [ ] Revue complète des Server Actions : `requireSession()` en première ligne,
      `userId` utilisé pour le scope, jamais un `userId` fourni par le client.
- [ ] Vérifier les 16 familles de routes API une par une.
- [ ] Chiffrement au repos des clés vérifié par test.
- [ ] Secrets jamais sérialisés dans les réponses, les logs ou les erreurs
      Next.js.
- [ ] CSP, en-têtes de sécurité, cookies (`SameSite`, `Secure`, `HttpOnly`).
- [ ] Protection contre l'énumération de comptes.
- [ ] Limite de taille des uploads par compte.
- [ ] RGPD : base légale, export, suppression, durée de conservation, registre.
- [ ] Audit Strix sur la branche avant mise en ligne.
- [ ] Test manuel de fuite : deux sessions, tentative d'accès par ID direct.

**Sortie** : aucune donnée d'un compte n'est accessible depuis un autre,
y compris via les routes API non documentées.

---

### Phase 8 : tests, documentation, migration et mise en ligne (4 à 5 jours)

- [ ] Tests unitaires : `lib/accounts`, `lib/secrets`, `lib/storage-core`.
- [ ] Tests d'isolation pour chaque domaine.
- [ ] Tests E2E : inscription, onboarding, chat, suppression de compte.
- [ ] Test E2E de non-fuite entre deux comptes.
- [ ] Script de migration `data/*.json` vers `data/users/owner/*.json`,
      idempotent, avec sauvegarde préalable.
- [ ] Mise à jour `AGENTS.md` : arborescence, invariants, variables d'env.
- [ ] Mise à jour `README.md`, `docs/architecture.md`, `docs/self-hosting.md`.
- [ ] Mise à jour `.env.example` et `.deploy.env.example` (nouvelle clé maître,
      `MAX_ACCOUNTS`, `SIGNUPS_OPEN`).
- [ ] Déploiement en staging, test avec 2 comptes réels.
- [ ] Ouverture progressive : 2 comptes, puis 5, puis 15.
- [ ] Plan de rollback : retour à l'instance mono-utilisateur possible.

**Sortie** : mise en production avec l'ancien compte migré intact et les
nouveaux comptes opérationnels.

---

## 4. Chemin critique et parallélisation

```
Phase 0
  └─ Phase 1 (auth)
       └─ Phase 2 (isolation)  ← bloque tout le reste
            ├─ Phase 3 (BYOK + coffre)
            │    └─ Phase 4 (compte + onboarding)
            └─ Phase 6 (exploitation)
                 └─ Phase 7 (sécurité)
                      └─ Phase 8 (tests, docs, mise en ligne)

Phase 5 (landing) : peut avancer en parallèle dès la Phase 0
```

Durée totale estimée : **3 à 4 semaines à temps plein**, plus la phase
d'ouverture progressive. Ne pas commencer la Phase 3 avant que la Phase 2 soit
terminée sur au moins 3 domaines, pour valider le pattern de scope.

---

## 5. Inventaire des fichiers touchés

### Stockage (à scoper)

`lib/storage-core.ts`, `lib/storage.ts`, puis les 15 modules
`lib/storage/*.ts`, plus `lib/config.ts`, `lib/consent.ts`, `lib/daily-brief.ts`,
`lib/focus.ts`, `lib/google-client.ts`, `lib/microsoft-client.ts`,
`lib/notification-scheduler.ts`, `lib/push-subscriptions.ts`,
`lib/fcm-devices.ts`, `lib/passkey-pairing.ts`, `lib/auth.ts`,
`lib/server-cache.ts`.

### Auth

`lib/session.ts`, `lib/session-core.ts`, `lib/session-edge.ts`, `proxy.ts`,
`app/api/auth/passkey/*`, `app/api/auth/logout`, `app/login/*`.

### IA

`lib/ai-providers/config.ts`, `lib/ai-providers/models.ts`,
`lib/ai-providers/openai.ts`, `lib/ai-providers/anthropic.ts`,
`app/api/demo/route.ts`.

### Interfaces

`app/settings/page.tsx`, `app/actions/settings.ts`, nouvelle page `app/account`,
onboarding, `components/landing/*`, `app/page.tsx`, `app/landing-content.ts`,
`app/landing.css`.

### Exploitation

`scripts/setup.ts`, `scripts/install.sh`, `deploy.sh`, `Dockerfile`,
`.env.example`, `.deploy.env.example`.

---

## 6. Risques et parades

| Risque | Impact | Parade |
| --- | --- | --- |
| Oubli d'un scope de stockage | Fuite de données entre comptes | Test grep + test d'isolation par domaine |
| Clés API en clair | Compromission des comptes utilisateurs | Chiffrement GCM + master key hors `data/` |
| Perte de passkey | Perte définitive du compte | Code de secours obligatoire à l'inscription |
| Croissance au-delà de 15 | Corruption de fichiers, lenteur | `MAX_ACCOUNTS`, liste d'attente, migration Postgres |
| Crons multi-comptes coûteux | Saturation CPU / disque | Quotas, exécution par lots, timeout par compte |
| Dépendance à un seul serveur | Indisponibilité totale | Backups quotidiens, procédure de restauration testée |
| Abus de l'endpoint démo | Coût IA alors que c'est gratuit | Rate limit par IP, plafond quotidien, pas de clé utilisateur |
| OAuth partagé par erreur | Un compte lit la boîte d'un autre | `state` lié au `userId`, tokens dans le coffre du compte |

---

## 7. Hors périmètre v1

- Facturation, abonnements, Stripe.
- Multi-instance, load balancing, Postgres.
- Application mobile multi-comptes (l'APK reste lié à une instance).
- Partage d'espace entre plusieurs comptes.
- Rôles administrateur avancés.
- Migration automatique des données d'un compte vers un autre.

---

## 8. Migration future vers Postgres

Le découpage est prévu pour que la bascule soit localisée :

- `lib/storage-core.ts` devient une interface (`StorageAdapter`) avec deux
  implémentations : fichiers et SQL.
- Les modules `lib/storage/*` ne connaissent que l'interface.
- Le scope `{ userId }` est déjà en place : il devient la clé de partition.
- `lib/secrets.ts` garde le même contrat, le déchiffrement reste applicatif.

Aucun changement d'API, de Server Action ou d'interface utilisateur n'est
nécessaire au moment de la bascule.

---

## 9. Definition of done

- [ ] Un visiteur crée un compte depuis la landing et note son code de secours.
- [ ] Il configure sa clé IA et obtient une réponse de son propre modèle.
- [ ] Un second compte ne voit rien du premier, sur aucun écran ni route API.
- [ ] Les clés sont chiffrées dans `data/`, jamais affichées ni journalisées.
- [ ] L'instance existante est migrée sans perte.
- [ ] Les 15 emplacements de comptes tiennent la charge.
- [ ] La landing annonce clairement le statut, la capacité et la branche.
- [ ] `bun run lint`, `bunx tsc --noEmit`, `bun run test` et `bun run test:e2e`
      passent.
- [ ] `AGENTS.md` et la documentation sont à jour.
