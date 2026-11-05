# Carte du code

Ce document repond a une seule question : **ou dois-je ecrire mon code ?**
Pour les invariants detailles (chat, memoire, CESAR, notifications), lire
[`docs/architecture.md`](../architecture.md). Pour les regles d'agent et les
pieges de build, lire [`AGENTS.md`](../../AGENTS.md).

---

## 1. Vue d'ensemble

```
app/                pages Next.js (App Router), Server Actions et Route Handlers
components/         composants React partages
lib/                logique serveur, stockage, clients externes, types
scripts/            setup, crons, reset de passkey
e2e/                tests Playwright
public/             service worker, manifeste, icones, captures
data/               donnees JSON locales (gitignore, jamais commite)
docs/               documentation produit, technique et contribution
```

Regle de placement d'un composant :

| Utilise par | Emplacement |
| --- | --- |
| Une seule page | `app/<page>/MonComposant.tsx` |
| Plusieurs pages | `components/<categorie>/MonComposant.tsx` |
| Primitive UI generique | `components/ui/` |

Le style ne s'ecrit pas dans les composants : les classes `.ui-*` de
`app/globals.css` portent les couleurs, rayons et espacements. Voir
[`docs/design.md`](../design.md).

## 2. Ajouter une page (un ecran)

1. Creer `app/<route>/page.tsx`.
2. Si la page est interactive, ajouter `"use client"` sur le composant qui porte
   l'etat, pas sur toute la page.
3. Charger les donnees via une Server Action ou un Server Component, jamais par
   un `fetch` interne depuis le client.
4. La route est privee par defaut : `proxy.ts` exige une session. Ne l'ajouter a
   `PUBLIC_PATHS` que si elle doit etre publique.
5. Ajouter la route au tableau de `README.md` si elle est visible par
   l'utilisateur.

Exemples a imiter : `app/today/page.tsx` (agregat serveur),
`app/settings/page.tsx` (formulaires clients), `app/watch-later/` (CRUD complet).

## 3. Ajouter une Server Action

Les Server Actions vivent dans `app/actions/<domaine>.ts` avec la directive
`"use server"` en tete de fichier.

```ts
"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addReminder, logActivity } from "@/lib/storage";

const schema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
});

export async function createReminder(input: { title: string }) {
  await requireSession();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const reminder = await addReminder(parsed.data);
  await logActivity("reminder_created", `Rappel cree : ${reminder.title}`);
  revalidatePath("/reminders");

  return reminder;
}
```

Regles :

- `requireSession()` en premiere ligne, toujours.
- Zod pour valider, `throw new Error("message en francais sans accent")`.
- Retourner la donnee brute, jamais `{ ok, error }`.
- `revalidatePath` apres une ecriture.
- Un fichier par domaine, pas un fichier fourre-tout.

Modele de reference : `app/actions/reminders.ts`.

## 4. Ajouter une route API

Les Route Handlers vivent dans `app/api/<domaine>/route.ts`.

1. Creer `app/api/mon-domaine/route.ts`.
2. Verifier la session au debut du handler :

   ```ts
   import { getSession } from "@/lib/session";

   export async function GET() {
     const session = await getSession();
     if (!session) {
       return Response.json({ error: "Non authentifie" }, { status: 401 });
     }
     // ...
   }
   ```

3. Ajouter `export const dynamic = "force-dynamic";` si la reponse depend de la
   requete ou de donnees mutables et ne doit jamais etre mise en cache.
4. Si la route doit rester publique, l'ajouter a `PUBLIC_API_PREFIXES` dans
   `proxy.ts` et documenter pourquoi.
5. Si un client non-React (service worker, APK) appelle cette route, verifier
   qu'une Server Action equivalente existe et reste synchronisee.

Routes a imiter : `app/api/reminders/[id]/done/route.ts` (action simple),
`app/api/chat/route.ts` (SSE, validation, rate limit),
`app/api/cron/reminders/route.ts` (route protegee par secret).

Attention : une route qui execute un outil IA a effet externe doit exiger une
session et ne jamais etre publique (`/api/chat/confirm`).

## 5. Ajouter un domaine de donnees

Le stockage est du JSON local, avec ecritures atomiques et verrous.

1. Type metier : `lib/types/<domaine>.ts`, re-exporte par `lib/types.ts`.
2. CRUD : `lib/storage/<domaine>.ts`, re-exporte par `lib/storage.ts`.
3. Ecriture : `mutateJson`, `writeJsonAtomic`, `readJsonSafe` depuis
   `lib/storage-core.ts`.
4. Nom de fichier : `data/<domaine>.json`, en kebab-case.
5. Ne jamais lire un fichier de `data/` directement avec `fs` dans une page :
   passer par le module de stockage.

Modele simple : `lib/storage/watch-later.ts`. Modele avec reconciliation
externe : `lib/storage/reminders.ts`.

## 6. Ajouter un outil IA

1. Declarer l'outil dans `lib/chat-tools.ts`.
2. Toute ecriture passe par `runTool` et se verifie par relecture.
3. Un outil a effet externe (mail, calendrier, suppression) s'ajoute a
   `REQUIRE_CONFIRMATION`.
4. Ajouter le statut `ok` / `error` / `empty` / `blocked` et un test.
5. Documenter le comportement dans `docs/architecture.md`.

Le detail des invariants est dans `docs/architecture.md` (section Chat).

## 7. Ajouter un test

| Type | Dossier | Commande |
| --- | --- | --- |
| Unitaire Vitest | `lib/__tests__/` ou `app/**/__tests__/` | `bunx vitest run <fichier>` |
| Route API | `app/api/<domaine>/__tests__/` | idem |
| Server Action | `app/actions/__tests__/` | idem |
| E2E Playwright | `e2e/` | `bun run test:e2e` |

Un test qui touche au systeme de fichiers mocke `process.cwd()` **puis**
importe dynamiquement le module de stockage (voir
`lib/__tests__/__fs-mock-helper.ts`).

Les tests E2E ne declenchent aucune mutation et n'appellent pas un vrai
provider IA.

## 8. Integrations externes

| Service | Client | Si absent |
| --- | --- | --- |
| Google (Gmail, Calendar) | `lib/google-client.ts` | widgets indisponibles |
| Microsoft To Do | `lib/microsoft-client.ts` | rappels locaux seulement |
| CESAR | `lib/cesar-client.ts` | pas de synchro d'emploi du temps |
| Web search | `lib/web.ts` | fallback DuckDuckGo |
| Push | `lib/send-push.ts` | pas de notification |

Aucune integration n'est requise pour lancer l'app ou les tests.

## 9. Mode de developpement sans cle

- `AI_PROVIDER=mock` : `lib/ai-providers/mock.ts` remplace les appels au modele.
- `DEV_AUTH_BYPASS=true` : `app/api/auth/dev-login/route.ts` ouvre une session
  locale, uniquement hors production.
- `bun run setup:dev` ecrit ces deux variables dans `.env.local`.

Ces chemins sont documentes et verrouilles : ne pas les etendre a la production.

## 10. Ou chercher quand on est perdu

1. Une route est protegee ou non : `proxy.ts`, puis `lib/session.ts`.
2. Un pattern d'action : `app/actions/reminders.ts`.
3. Un invariant de chat ou de memoire : `docs/architecture.md`.
4. Un composant ou un style : `docs/design.md`.
5. Un deploiement : `docs/self-hosting.md`, `docs/deploy-cpanel.md`.
6. Une API Next.js incertaine : `node_modules/next/dist/docs/`.
