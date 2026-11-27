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
import fs from "node:fs";
import path from "node:path";

import { config as loadEnv } from "dotenv";

import { hasStandaloneServer, prepareStandaloneAssets } from "./standalone-assets";

const root = process.cwd();
const dataDir = path.join(root, "data");
const standaloneData = path.join(root, ".next", "standalone", "data");

/**
 * Le serveur standalone fait `process.chdir(.next/standalone)` : `data/` designe
 * alors le dossier du build, qu'un `bun run build` efface. On relie donc le
 * dossier du standalone au vrai `data/` de la racine.
 *
 * Une installation deja lancee avec l'ancienne disposition a pu ecrire dans le
 * build : on rapatrie ses fichiers avant de remplacer le dossier par le lien.
 */
function linkStandaloneData(): void {
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    if (fs.lstatSync(standaloneData).isSymbolicLink()) {
      if (fs.realpathSync(standaloneData) === fs.realpathSync(dataDir)) return;
      fs.unlinkSync(standaloneData);
    } else {
      fs.cpSync(standaloneData, dataDir, { recursive: true, force: false });
      fs.rmSync(standaloneData, { recursive: true, force: true });
    }
  } catch {
    // Dossier absent : rien a reprendre.
  }
  try {
    fs.symlinkSync(dataDir, standaloneData, "dir");
  } catch (err) {
    console.warn(
      "[start] lien data/ impossible : les donnees resteront dans .next/standalone/data",
      err
    );
  }
}

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
linkStandaloneData();

console.log(`[start] serveur standalone sur http://${hostname}:${port}`);
console.log(`[start] donnees : ${dataDir}`);

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
