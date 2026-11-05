# Ta premiere PR en 15 minutes

Objectif : partir d'un depot clone, faire une modification utile, la verifier et
ouvrir une pull request propre. Aucune cle API, aucun compte cloud.

Exemple de premiere contribution : ajouter un test sur le mode `mock`, corriger
un message d'erreur trop vague, ou completer cette documentation. Choisis une
issue avec le label `good first issue`.

---

## Minute 0 a 3 : installer

```bash
git clone https://github.com/MattiaPARRINELLO/backstage.git
cd backstage
bun install
bun run setup:dev
bun dev
```

Ouvre <http://localhost:3000/api/auth/dev-login> : une session locale s'ouvre
sans passkey et redirige vers `/chat`. Le chat repond avec le provider factice.

Si `bun` n'est pas installe : <https://bun.sh>. Node.js 20.9 ou plus est
necessaire pour le build de production, pas pour `bun dev`.

## Minute 3 a 6 : choisir et comprendre

1. Ouvre les issues filtrees par `good first issue`.
2. Lis la carte du code : [`code-map.md`](./code-map.md).
3. Ouvre le fichier cite dans l'issue et les tests voisins.
4. Si l'issue est ambigue, demande une precision **avant** d'ecrire du code.

Exemple concret, l'issue « tester le mode mock » :

- fichier a lire : `lib/ai-providers/mock.ts` ;
- test voisin : `lib/__tests__/ai-providers-mock.test.ts` ;
- commande ciblee :
  `bunx vitest run lib/__tests__/ai-providers-mock.test.ts`.

## Minute 6 a 10 : coder

```bash
git switch -c test/mock-provider
```

Regles minimales :

- une seule intention par branche ;
- pas de reformatage global ;
- message d'erreur en francais, sans accent, si tu en ajoutes un ;
- pas de secret, pas de donnee personnelle, pas de fichier `data/`.

Ajoute ou adapte le test, puis lance uniquement ce fichier pendant l'iteration :

```bash
bunx vitest run lib/__tests__/ai-providers-mock.test.ts
```

## Minute 10 a 13 : verifier

Avant de committer, lance la liste que la CI lancera :

```bash
bun run lint
bunx tsc --noEmit
bun run test
```

Le build complet prend plus de temps mais reste obligatoire avant la PR :

```bash
bun run build
```

Pour une modification d'interface, ajoute une capture avant / apres. Pour un
changement de comportement, mets a jour la documentation concernee.

## Minute 13 a 15 : commit et pull request

```bash
git add -A
git commit -m "test(mock): couvre le flux SSE du provider factice"
git push -u origin test/mock-provider
```

Ouvre ensuite la pull request sur GitHub. Le modele de PR demande :

- ce que fait la PR et l'issue liee ;
- la checklist reellement executee ;
- une capture si l'interface change ;
- **la mention de l'aide IA** si un assistant a participe.

Une PR de 30 lignes avec un test et une description claire sera relue plus vite
qu'une PR de 800 lignes sans contexte.

## Les cinq erreurs qui font perdre du temps

1. Lancer `npm` ou `yarn` : le depot utilise **Bun** et `bun.lock`.
2. Committer `.env.local` ou `data/` : ils sont gitignores, garde-les ainsi.
3. Ecrire une Server Action sans `requireSession()`.
4. Ajouter une route publique sans la declarer dans `proxy.ts`.
5. Annoncer « tests passes » sans avoir lance les commandes.

## Apres l'ouverture

- Reponds aux commentaires par des commits supplementaires sur la meme branche.
- Ne force-push pas une PR en cours de relecture sans prevenir.
- Si la CI echoue, lis le job en erreur avant de relancer.
- Un mainteneur peut demander de decouper la PR : ce n'est pas un refus.

Bienvenue dans le projet.
