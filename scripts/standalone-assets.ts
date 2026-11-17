import { cpSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Copie dans `.next/standalone` ce que Next n'y met pas.
 *
 * `output: "standalone"` produit un serveur autonome, mais sans les assets
 * statiques ni `public/` : le Dockerfile les copie explicitement, et sans eux
 * une page se charge sans style ni icone. Ce module fait la même copie pour un
 * démarrage local.
 */
export interface PrepareResult {
  copied: string[];
  skipped: string[];
}

export function prepareStandaloneAssets(root: string): PrepareResult {
  const standalone = path.join(root, ".next", "standalone");
  const copied: string[] = [];
  const skipped: string[] = [];

  const copies = [
    { from: path.join(root, ".next", "static"), to: path.join(standalone, ".next", "static"), label: ".next/static" },
    { from: path.join(root, "public"), to: path.join(standalone, "public"), label: "public" },
    { from: path.join(root, "assets"), to: path.join(standalone, "assets"), label: "assets" },
  ];

  for (const { from, to, label } of copies) {
    if (!existsSync(from)) {
      skipped.push(label);
      continue;
    }
    // `force` remplace un fichier existant, `recursive` couvre le dossier.
    cpSync(from, to, { recursive: true, force: true });
    copied.push(label);
  }

  return { copied, skipped };
}

/** Le build standalone existe-t-il ? Sinon, `bun run build` n'a pas été lancé. */
export function hasStandaloneServer(root: string): boolean {
  return existsSync(path.join(root, ".next", "standalone", "server.js"));
}
