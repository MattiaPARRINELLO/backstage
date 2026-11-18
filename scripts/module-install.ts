/**
 * Installation et inspection des modules externes (ADR 0001, decision K).
 *
 *   bun run module:add <url-git>#<ref>
 *   bun run module:list
 *   bun run module:doctor
 *
 * `add` clone la ref, fige le commit dans modules.lock.json, active le module
 * et l'ajoute a la racine de composition. Un build Next reste necessaire.
 */
import { doctorModules, installModule, readLock } from "../lib/kernel/module-install";

function usage(): never {
  console.error(
    "Usage : bun scripts/module-install.ts <add <url>#<ref> | list | doctor>"
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);
  const root = process.cwd();

  if (command === "add") {
    if (!argument) usage();
    const installed = await installModule({ root, source: argument });
    console.log(`Module "${installed.id}" installe.`);
    console.log(`  version    : ${installed.apiVersion}`);
    console.log(`  commit     : ${installed.commit}`);
    console.log(`  depot      : ${installed.repo}#${installed.ref}`);
    console.log(`  capacites  : ${JSON.stringify(installed.capabilities)}`);
    console.log("Rebuild requis : bun run build");
    return;
  }

  if (command === "list") {
    const lock = readLock(root);
    const entries = Object.entries(lock.modules);
    if (entries.length === 0) {
      console.log("Aucun module externe installe.");
      return;
    }
    for (const [id, entry] of entries) {
      console.log(`${id}  ${entry.commit}  ${entry.repo}#${entry.ref}  ${entry.installedAt}`);
    }
    return;
  }

  if (command === "doctor") {
    const issues = await doctorModules(root);
    if (issues.length === 0) {
      console.log("Modules externes : aucun probleme detecte.");
      return;
    }
    for (const issue of issues) console.error(`${issue.id} : ${issue.problem}`);
    process.exit(1);
  }

  usage();
}

await main();
