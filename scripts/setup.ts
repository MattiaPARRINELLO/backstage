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
 * Usage : bun run setup            (relançable, idempotent)
 */

import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import webpush from "web-push";

const ENV_FILE = path.join(process.cwd(), ".env.local");

/** Valeurs que le script sait générer seul. */
function generateValue(key: string): { value: string; comment: string } | null {
  switch (key) {
    case "AUTH_SECRET":
      return { value: randomBytes(32).toString("hex"), comment: "signature des JWT de session (généré)" };
    case "SETUP_TOKEN":
      // One-time, lisible au clavier (préfixe + hex), à retirer après le setup.
      return { value: `setup-${randomBytes(12).toString("hex")}`, comment: "bootstrap passkey (généré, one-time)" };
    case "WEBAUTHN_RP_ID":
      return { value: "localhost", comment: "domaine de la passkey (à changer en prod)" };
    case "WEBAUTHN_ORIGIN":
      return { value: "http://localhost:3000", comment: "origine WebAuthn (https://… en prod)" };
    case "VAPID_SUBJECT":
      return { value: "mailto:admin@example.com", comment: "contact Web Push (à renseigner)" };
    default:
      return null;
  }
}

/** Valeurs lues dans .env.local (clés déjà définies, même vides). */
function readExisting(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ENV_FILE)) return map;
  for (const raw of readFileSync(ENV_FILE, "utf-8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(raw.trim());
    if (!m) continue;
    // Commentaire en fin de ligne retiré de la valeur (sinon il se
    // réaccumulerait à chaque exécution et polluerait la valeur lue).
    const value = m[2].replace(/\s+#.*$/, "").trim();
    map.set(m[1], value);
  }
  return map;
}

function block(title: string): string {
  return `\n# ────────────────────────────────────────────────────────────────────\n# ${title}\n# ────────────────────────────────────────────────────────────────────\n`;
}

async function main() {
  // La paire VAPID est générée une seule fois pour les deux variables.
  const vapid = webpush.generateVAPIDKeys();

  const existing = readExisting();
  const keys = [
    { key: "AUTH_SECRET", block: "SECURITE (obligatoire)", comment: "signature des JWT de session" },
    { key: "SETUP_TOKEN", block: "SECURITE (obligatoire)", comment: "protection du premier enregistrement passkey" },
    { key: "NEXT_PUBLIC_VAPID_PUBLIC_KEY", block: "NOTIFICATIONS PUSH (optionnel)", comment: "clé publique VAPID" },
    { key: "VAPID_PRIVATE_KEY", block: "NOTIFICATIONS PUSH (optionnel)", comment: "clé privée VAPID" },
    { key: "VAPID_SUBJECT", block: "NOTIFICATIONS PUSH (optionnel)", comment: "contact Web Push (mailto:)" },
    { key: "WEBAUTHN_RP_ID", block: "PASSKEY (obligatoire)", comment: "domaine de la passkey" },
    { key: "WEBAUTHN_ORIGIN", block: "PASSKEY (obligatoire)", comment: "origine WebAuthn" },
  ];

  const created: string[] = [];
  const kept: string[] = [];
  const lines: string[] = [
    "# ════════════════════════════════════════════════════════════════",
    "# BACKSTAGE — configuration locale générée par `bun run setup`",
    "# Ne jamais committer ce fichier (voir .gitignore).",
    "# ════════════════════════════════════════════════════════════════",
    "",
  ];

  let lastBlock = "";
  for (const { key, block: blockName, comment } of keys) {
    if (blockName !== lastBlock) {
      lines.push(block(blockName));
      lastBlock = blockName;
    }
    const current = existing.get(key);
    if (current && current.trim().length > 0) {
      lines.push(`${key}=${current}   # ${comment} — conservé`);
      kept.push(key);
      continue;
    }
    const value =
      key === "NEXT_PUBLIC_VAPID_PUBLIC_KEY"
        ? vapid.publicKey
        : key === "VAPID_PRIVATE_KEY"
          ? vapid.privateKey
          : generateValue(key)?.value;
    if (!value) continue;
    lines.push(`${key}=${value}   # ${comment}`);
    created.push(key);
  }

  // Bloc des clés à renseigner à la main. Toujours émis (valeur conservée si
  // elle existe) pour que la génération reste strictement idempotente.
  // Le commentaire est sur sa propre ligne : un commentaire en fin de ligne
  // d'une valeur vide serait lu comme la valeur par certains parseurs.
  const manual: [string, string][] = [
    ["NEXT_PUBLIC_API_URL", "URL du provider IA (compatible OpenAI)"],
    ["IA_API_KEY", "clé API du provider IA"],
  ];
  lines.push(block("API IA (obligatoire pour le chat)"));
  for (const [key, comment] of manual) {
    const current = existing.get(key);
    lines.push(`# ${comment}`, `${key}=${current ?? ""}${current ? `   # ${comment} — conservé` : ""}`, "");
  }
  lines.push(
    "# Les autres intégrations (Gmail/Calendar, Microsoft To Do, météo,",
    "# recherche web, CESAR) sont optionnelles : voir .env.example.",
    ""
  );

  writeFileSync(ENV_FILE, lines.join("\n"), { mode: 0o600 });

  console.log(`\n✓ ${ENV_FILE} mis à jour`);
  if (created.length) console.log(`  Généré  : ${created.join(", ")}`);
  if (kept.length) console.log(`  Conservé : ${kept.join(", ")}`);
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
