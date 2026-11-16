/**
 * Setup initial d'une installation auto-hébergée.
 *
 * Génère les secrets qui doivent être locaux (jamais commités) et complète
 * `.env.local` sans jamais écraser une valeur déjà renseignée :
 *   - AUTH_SECRET                    signature des JWT de session
 *   - SETUP_TOKEN                    protection du premier enregistrement passkey
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY   paire VAPID Web Push
 *   - VAPID_PRIVATE_KEY
 *   - WEBAUTHN_RP_ID / ORIGIN        domaine de l'installation
 *
 * Les variables ajoutées à la main (Google, Microsoft, CESAR, CRON_SECRET,
 * météo…) et leurs commentaires sont conservés : seules les clés gérées sont
 * réécrites (voir `lib/env-file.ts`).
 *
 * Usage : bun run setup            (relançable, idempotent)
 *         bun run setup:dev        (ajoute AI_PROVIDER=mock et DEV_AUTH_BYPASS,
 *                                   pour developper sans cle API ni passkey)
 */

import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import webpush from "web-push";
import { mergeEnvFile, type ManagedEnvEntry } from "../lib/env-file";

const ENV_FILE = path.join(process.cwd(), ".env.local");
const DEV_MODE = process.argv.includes("--dev");

const HEADER = `# ════════════════════════════════════════════════════════════════
# BACKSTAGE — configuration locale générée par \`bun run setup\`
# Ne jamais committer ce fichier (voir .gitignore).
# ════════════════════════════════════════════════════════════════
`;

/** Valeurs que le script sait générer seul. */
function generateValue(key: string): string | null {
  switch (key) {
    case "AUTH_SECRET":
      return randomBytes(32).toString("hex");
    case "SETUP_TOKEN":
      // One-time, lisible au clavier (préfixe + hex), à retirer après le setup.
      return `setup-${randomBytes(12).toString("hex")}`;
    case "WEBAUTHN_RP_ID":
      return "localhost";
    case "WEBAUTHN_ORIGIN":
      return "http://localhost:3000";
    case "VAPID_SUBJECT":
      return "mailto:admin@example.com";
    default:
      return null;
  }
}

async function main() {
  // La paire VAPID est générée une seule fois, et seulement si nécessaire.
  let vapidKeys: { publicKey: string; privateKey: string } | null = null;
  const vapid = () => (vapidKeys ??= webpush.generateVAPIDKeys());

  const entries: ManagedEnvEntry[] = [
    {
      key: "AUTH_SECRET",
      block: "SECURITE (obligatoire)",
      comment: "signature des JWT de session",
      generate: () => generateValue("AUTH_SECRET") ?? undefined,
    },
    {
      key: "SETUP_TOKEN",
      block: "SECURITE (obligatoire)",
      comment: "protection du premier enregistrement passkey",
      generate: () => generateValue("SETUP_TOKEN") ?? undefined,
    },
    {
      key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
      block: "NOTIFICATIONS PUSH (optionnel)",
      comment: "clé publique VAPID",
      generate: () => vapid().publicKey,
    },
    {
      key: "VAPID_PRIVATE_KEY",
      block: "NOTIFICATIONS PUSH (optionnel)",
      comment: "clé privée VAPID",
      generate: () => vapid().privateKey,
    },
    {
      key: "VAPID_SUBJECT",
      block: "NOTIFICATIONS PUSH (optionnel)",
      comment: "contact Web Push (mailto:)",
      generate: () => generateValue("VAPID_SUBJECT") ?? undefined,
    },
    {
      key: "WEBAUTHN_RP_ID",
      block: "PASSKEY (obligatoire)",
      comment: "domaine de la passkey",
      generate: () => generateValue("WEBAUTHN_RP_ID") ?? undefined,
    },
    {
      key: "WEBAUTHN_ORIGIN",
      block: "PASSKEY (obligatoire)",
      comment: "origine WebAuthn (https://… en prod)",
      generate: () => generateValue("WEBAUTHN_ORIGIN") ?? undefined,
    },
    {
      key: "NEXT_PUBLIC_API_URL",
      block: DEV_MODE
        ? "API IA (optionnel en mode developpement)"
        : "API IA (obligatoire pour le chat)",
      comment: "URL du provider IA (compatible OpenAI)",
    },
    {
      key: "IA_API_KEY",
      block: DEV_MODE
        ? "API IA (optionnel en mode developpement)"
        : "API IA (obligatoire pour le chat)",
      comment: "clé API du provider IA",
    },
  ];

  if (DEV_MODE) {
    entries.push(
      {
        key: "AI_PROVIDER",
        block: "MODE DEVELOPPEMENT (sans cle API ni passkey)",
        comment: "mock | (vide) = provider reel",
        generate: () => "mock",
      },
      {
        key: "DEV_AUTH_BYPASS",
        block: "MODE DEVELOPPEMENT (sans cle API ni passkey)",
        comment: "session locale sans WebAuthn, ignoree en production",
        generate: () => "true",
      }
    );
  }

  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8") : null;
  const { content, created, kept } = mergeEnvFile(existing, entries, HEADER);

  writeFileSync(ENV_FILE, content, { mode: 0o600 });

  console.log(`\n✓ ${ENV_FILE} mis à jour`);
  if (created.length) console.log(`  Généré  : ${created.join(", ")}`);
  if (kept.length) console.log(`  Conservé : ${kept.join(", ")}`);
  if (DEV_MODE) {
    console.log(
      "\nMode developpement : aucune cle API ni passkey n'est necessaire.\n" +
        "  1. bun dev\n" +
        "  2. Ouvrir http://localhost:3000/api/auth/dev-login (session locale)\n" +
        "  3. Pour un vrai provider : retirer AI_PROVIDER=mock et DEV_AUTH_BYPASS,\n" +
        "     puis renseigner NEXT_PUBLIC_API_URL et IA_API_KEY\n" +
        "\nDetail : CONTRIBUTING.md et docs/contributing/"
    );
    return;
  }

  console.log(
    "\nReste à faire :\n" +
      "  1. Renseigner NEXT_PUBLIC_API_URL et IA_API_KEY (provider compatible OpenAI) dans .env.local\n" +
      "  2. En prod : remplacer WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN par votre domaine\n" +
      "  3. bun install puis bun dev, ouvrir /login et enregistrer votre passkey\n" +
      "  4. Ce SETUP_TOKEN ne sert qu'une fois : retirez-le de l'environnement ensuite\n" +
      "\nDétail complet : docs/self-hosting.md"
  );
}

main().catch((err) => {
  console.error("[setup] Erreur:", err);
  process.exit(1);
});
