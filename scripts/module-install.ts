/**
 * Installation et inspection des modules externes (ADR 0001, decision K).
 *
 *   bun run module:add <url-git>#<ref>
 *   bun run module:list
 *   bun run module:doctor
 *   bun run module:update <id> [#ref]
 *   bun run module:remove <id>
 *   bun run module:enable <id>
 *   bun run module:disable <id>
 *
 * `add` clone la ref, fige le commit dans modules.lock.json, active le module
 * et l'ajoute a la racine de composition. Un build Next reste necessaire.
 */
import {
  disableModule,
  doctorModules,
  enableModule,
  installModule,
  readLock,
  removeModule,
  updateModule,
} from "../lib/kernel/module-install";

function usage(): never {
  console.error(
    [
      "Usage : bun scripts/module-install.ts <commande>",
      "",
      "  add <url-git>#<ref>   installe un module externe (commit fige)",
      "  list                  liste les modules externes installes",
      "  doctor                verifie lock, activation et dossiers temporaires",
      "  update <id> [#ref]    reinstalle la ref du lock, ou change de version",
      "  remove <id>           retire dossier, config, composition et lock",
      "  enable <id>           active un module dans modules.config.json",
      "  disable <id>          desactive un module dans modules.config.json",
      "",
      "Codes de sortie : 0 succes, 1 erreur.",
    ].join("\n")
  );
  process.exit(1);
}

function requireArgument(value: string | undefined, hint: string): string {
  if (!value) {
    console.error(hint);
    usage();
  }
  return value;
}

function normalizeRef(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const ref = value.startsWith("#") ? value.slice(1) : value;
  return ref.trim() || undefined;
}

async function main(): Promise<void> {
  const [command, argument, extra] = process.argv.slice(2);
  const root = process.cwd();

  if (command === "add") {
    const source = requireArgument(argument, "Source requise : <url-git>#<ref>.");
    const installed = await installModule({ root, source });
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

  if (command === "update") {
    const id = requireArgument(argument, "Identifiant requis : update <id> [#ref].");
    const ref = normalizeRef(extra);
    const updated = ref ? await updateModule({ root, id, ref }) : await updateModule({ root, id });

    console.log(`Module "${updated.id}" mis a jour.`);
    console.log(`  commit     : ${updated.commit}`);
    console.log(`  depot      : ${updated.repo}#${updated.ref}`);
    console.log(`  version    : ${updated.apiVersion}`);
    console.log("Rebuild requis : bun run build");
    return;
  }

  if (command === "remove") {
    const id = requireArgument(argument, "Identifiant requis : remove <id>.");
    const removed = removeModule(root, id);
    console.log(
      removed.removedDirectory
        ? `Module "${removed.id}" retire (dossier, config, composition, lock).`
        : `Module "${removed.id}" retire du lock et de la composition (dossier deja absent).`
    );
    console.log("Rebuild requis : bun run build");
    return;
  }

  if (command === "enable" || command === "disable") {
    const id = requireArgument(argument, `Identifiant requis : ${command} <id>.`);
    if (command === "enable") enableModule(root, id);
    else disableModule(root, id);
    console.log(
      `Module "${id}" ${command === "enable" ? "active" : "desactive"} dans modules.config.json.`
    );
    console.log("Rebuild requis : bun run build");
    return;
  }

  usage();
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
