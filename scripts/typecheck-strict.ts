/**
 * Typecheck strict par perimetre (issue #90).
 *
 * `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` sont actives pour
 * `lib/kernel/`, `modules/` et `packages/module-kit/` via `tsconfig.strict.json`.
 *
 * TypeScript n'a pas de notion de fichier « verifie » : un fichier importe
 * entre dans le programme, donc les dependances du perimetre sont typees aussi
 * et leurs erreurs apparaissent. Ce script ne garde que les diagnostics dont le
 * fichier appartient au perimetre, et echoue seulement sur ceux-la. Le reste
 * est affiche en information : c'est la dette a resorber avant d'activer les
 * options globalement.
 */
import { spawnSync } from "node:child_process";

const SCOPE = /^(lib\/kernel\/|modules\/|packages\/module-kit\/)/;
const TS_ERROR = /error TS\d+/;

const result = spawnSync("bunx", ["tsc", "-p", "tsconfig.strict.json", "--pretty", "false"], {
  encoding: "utf8",
});

const lines = `${result.stdout ?? ""}${result.stderr ?? ""}`
  .split("\n")
  .map((line) => line.replace(/\\/g, "/"))
  .filter((line) => line.trim().length > 0);

const scoped = lines.filter((line) => SCOPE.test(line) && TS_ERROR.test(line));
const outside = lines.filter((line) => TS_ERROR.test(line) && !SCOPE.test(line));

if (outside.length > 0) {
  console.log(
    `[typecheck-strict] ${outside.length} erreur(s) hors perimetre, a resorber avant l'activation globale.`
  );
}

if (scoped.length > 0) {
  console.error(`[typecheck-strict] ${scoped.length} erreur(s) dans le perimetre strict :`);
  for (const line of scoped) console.error(line);
  process.exit(1);
}

if (result.status !== 0 && outside.length === 0) {
  // Echec qui ne vient pas d'un diagnostique situe (configuration, option
  // inconnue) : le faire remonter tel quel plutot que de le masquer.
  console.error(`[typecheck-strict] tsc a echoue sans diagnostic exploitable :`);
  console.error(lines.join("\n"));
  process.exit(1);
}

console.log("[typecheck-strict] noyau, modules et kit : aucune erreur.");
