/**
 * Sert le build de production : `bun run start`.
 *
 * `next start` refuse `output: "standalone"`, et le serveur standalone ne lit
 * pas `.env.local` (en production, l'orchestrateur fournit les variables). Ce
 * script fait les trois choses qui manquent, dans cet ordre : vérifier le
 * build, copier les assets statiques que Next omet, charger `.env.local`, puis
 * lancer le serveur.
 */
import { spawn } from "node:child_process";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { hasStandaloneServer, prepareStandaloneAssets } from "./standalone-assets";

const root = process.cwd();

if (!hasStandaloneServer(root)) {
  console.error(
    "[start] build standalone introuvable. Lancer `bun run build`, puis `bun run start`."
  );
  process.exit(1);
}

const { copied, skipped } = prepareStandaloneAssets(root);
if (copied.length > 0) {
  console.log(`[start] assets copies : ${copied.join(", ")}`);
}
if (skipped.length > 0) {
  console.log(`[start] absents, ignores : ${skipped.join(", ")}`);
}

// `override: false` : une variable deja fournie par l'environnement (Docker,
// cPanel, `PORT=4000 bun run start`) garde la priorite sur .env.local.
loadEnv({ path: path.join(root, ".env.local"), override: false, quiet: true });

const port = process.env.PORT || "3000";
const hostname = process.env.HOSTNAME || "0.0.0.0";

console.log(`[start] serveur standalone sur http://${hostname}:${port}`);

const child = spawn(process.execPath, [path.join(root, ".next", "standalone", "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[start] serveur arrete par ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
