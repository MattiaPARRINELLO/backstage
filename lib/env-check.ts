/**
 * Verification des variables d'environnement au demarrage.
 *
 * Module pur : aucune lecture de fichier, aucun effet de bord, aucune valeur
 * secrete dans les messages. `checkDevEnv()` renvoie la liste des problemes
 * detectes ; l'appelant (`instrumentation.ts`) se charge de les afficher.
 *
 * Le but est d'aider l'installateur : les consequences sont expliquees, pas
 * seulement le nom de la variable manquante.
 */

export function checkDevEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  const isMock = env.AI_PROVIDER === "mock";
  const isProduction = env.NODE_ENV === "production";

  if (!isMock) {
    if (!env.NEXT_PUBLIC_API_URL?.trim()) {
      problems.push(
        "NEXT_PUBLIC_API_URL est absent : renseigner l'URL du provider IA (endpoint compatible OpenAI) dans .env.local, puis redemarrer. Sans elle, le chat echoue au premier message."
      );
    }
    if (!env.IA_API_KEY?.trim()) {
      problems.push(
        "IA_API_KEY est absent : renseigner la cle du provider IA dans .env.local, puis redemarrer. Sans elle, le chat echoue au premier message. Pour developper sans cle, utiliser AI_PROVIDER=mock."
      );
    }
  }

  if (!env.AUTH_SECRET?.trim()) {
    problems.push(
      "AUTH_SECRET est absent : lancer `bun run setup` (ou renseigner une chaine aleatoire longue) puis redemarrer. Sans lui, aucune session ne peut etre signee : la connexion passkey echoue."
    );
  }

  const origin = env.WEBAUTHN_ORIGIN?.trim();
  const rpId = env.WEBAUTHN_RP_ID?.trim();

  if (!origin) {
    problems.push(
      "WEBAUTHN_ORIGIN est absent : renseigner l'origine publique de l'application (par exemple http://localhost:3000 en local, https://votre-domaine en production) puis redemarrer. Sans elle, les passkeys ne peuvent pas etre enregistrees."
    );
  } else if (!origin.startsWith("http")) {
    problems.push(
      `WEBAUTHN_ORIGIN commence par "${origin.split(":")[0]}:" : il doit commencer par http:// ou https:// (l'origine complete du navigateur) pour que WebAuthn accepte les passkeys.`
    );
  } else if (!rpId) {
    problems.push(
      "WEBAUTHN_RP_ID est absent : renseigner le domaine de l'application (par exemple localhost ou votre-domaine) puis redemarrer. Sans lui, l'origine WEBAUTHN_ORIGIN ne peut pas etre validee."
    );
  } else if (!origin.includes(rpId)) {
    problems.push(
      "WEBAUTHN_ORIGIN ne contient pas WEBAUTHN_RP_ID : les deux doivent designer le meme domaine (par exemple WEBAUTHN_RP_ID=backstage.example.com et WEBAUTHN_ORIGIN=https://backstage.example.com), sinon les passkeys sont refusees par le navigateur."
    );
  }

  if (isProduction && !env.SETUP_TOKEN?.trim()) {
    problems.push(
      "SETUP_TOKEN est absent en production : le premier enregistrement de passkey sera refuse avec HTTP 503 (garde-fou volontaire). Generer un token avec `bun run setup`, l'utiliser une fois, puis le retirer."
    );
  }

  return problems;
}
