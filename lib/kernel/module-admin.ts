import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  configPath,
  disableModule,
  doctorModules,
  enableModule,
  installModule,
  parseModuleSource,
  readComposition,
  readLock,
  removeModule,
  serializeConfig,
  type InstalledModule,
} from "./module-install";
import { enabledConfigError, getRegistry, invalidateRegistry } from "./registry";
import { invalidateRuntimeConfig, readRuntimeConfig } from "./runtime-config";

/**
 * Gestion des modules depuis l'interface (issue #270).
 *
 * Ce fichier ne connait ni la session ni Next : il prend une racine et rend des
 * donnees brutes, pour rester testable avec un depot temporaire. Les actions de
 * `app/actions/modules.ts` ajoutent la session, Zod et le journal d'activite.
 *
 * Regle d'honnetete : l'etat affiche vient du **registre en cours d'execution**
 * (`getRegistry()`), la config n'est que l'intention. Un module encore servi
 * alors que la config le dit desactive est en `rebuild`, jamais en `inactive`.
 */

const MOBILE_REFS = new Set(["main", "master", "develop", "head"]);

export type ModuleStatus = "active" | "inactive" | "rebuild";

export interface ModuleRow {
  readonly id: string;
  readonly label: string;
  /** Le registre en cours sert-il ce module ? */
  readonly served: boolean;
  readonly active: boolean;
  /** Valeur ecrite dans `modules.config.json`. */
  readonly configured: boolean;
  readonly status: ModuleStatus;
  readonly repo: string | null;
  readonly ref: string | null;
  readonly commit: string | null;
  readonly installedAt: string | null;
  /** Present dans `modules/index.ts` mais absent du lock. */
  readonly bundled: boolean;
  readonly issues: string[];
  /** Une issue du doctor interdit la bascule. */
  readonly blocked: boolean;
}

export interface ModulesState {
  readonly root: string;
  readonly modules: ModuleRow[];
  /** Au moins un module attend un rebuild pour que l'affichage soit vrai. */
  readonly rebuildRequired: boolean;
  /** `build` : aucun fichier a la racine, la config vient du build. */
  readonly configSource: "file" | "build";
  /** Problemes du doctor qui ne concernent aucun module du lock. */
  readonly orphanIssues: string[];
}

export interface ModuleToggleResult {
  readonly id: string;
  readonly enabled: boolean;
}

export interface ModuleInstallResult {
  readonly id: string;
  readonly commit: string;
  readonly capabilities: unknown;
  readonly rebuildRequired: true;
}

export interface ModuleRemoveResult {
  readonly id: string;
  readonly rebuildRequired: true;
}

/** Racine de travail. Isole pour que les tests la remplacent par un depot temporaire. */
export function modulesRoot(): string {
  return process.cwd();
}

/**
 * Materialise `modules.config.json` quand seule la config de build existe
 * (sortie standalone). Sans ce fichier, `enableModule` croirait que tout est
 * deja desactive et refuserait la bascule.
 */
function ensureConfigOnDisk(root: string): void {
  const runtime = readRuntimeConfig(root);
  if (runtime.source === "file") return;
  writeFileSync(configPath(root), serializeConfig(runtime.config), "utf8");
  invalidateRuntimeConfig();
}

function compositionIds(root: string): string[] {
  try {
    const composition = readComposition(join(root, "modules"));
    return [...composition.source.matchAll(/from "\.\/([^/"]+)\/module"/g)].flatMap(
      (match) => (match[1] === undefined ? [] : [match[1]])
    );
  } catch {
    // Sortie standalone : `modules/index.ts` vit dans le bundle, pas sur disque.
    return getRegistry().modules.map((definition) => definition.id);
  }
}

/** Le doctor signale une simple desactivation : c'est un etat, pas une erreur. */
function isActivationNote(problem: string): boolean {
  return problem.startsWith("installe mais desactive");
}

export async function readModulesState(root: string): Promise<ModulesState> {
  const registry = getRegistry();
  const runtime = readRuntimeConfig(root);
  const lock = readLock(root);
  const inBuild = compositionIds(root);
  const issues = await doctorModules(root);

  const ids = new Set<string>([
    ...inBuild,
    ...Object.keys(lock.modules),
    ...Object.keys(runtime.config.modules ?? {}),
    ...registry.modules.map((definition) => definition.id),
    ...issues.map((issue) => issue.id),
  ]);

  const rows: ModuleRow[] = [...ids].sort((a, b) => a.localeCompare(b)).map((id) => {
    const definition = registry.module(id);
    const active = registry.enabled.some((entry) => entry.id === id);
    const configured = runtime.config.modules?.[id]?.enabled === true;
    const served = definition !== undefined;
    const entry = lock.modules[id];
    const moduleIssues = issues.filter((issue) => issue.id === id).map((issue) => issue.problem);
    const blocking = moduleIssues.filter((problem) => !isActivationNote(problem));

    const status: ModuleStatus = !served
      ? configured
        ? "rebuild"
        : "inactive"
      : active === configured
        ? active
          ? "active"
          : "inactive"
        : "rebuild";

    return {
      id,
      label: definition?.label ?? id,
      served,
      active,
      configured,
      status,
      repo: entry?.repo ?? null,
      ref: entry?.ref ?? null,
      commit: entry?.commit ?? null,
      installedAt: entry?.installedAt ?? null,
      bundled: inBuild.includes(id) && entry === undefined,
      issues: moduleIssues,
      blocked: blocking.length > 0,
    };
  });

  const orphanIssues = issues
    .filter((issue) => issue.id.startsWith(".install-"))
    .map((issue) => `${issue.id} : ${issue.problem}`);

  return {
    root,
    modules: rows,
    rebuildRequired: rows.some((row) => row.status === "rebuild"),
    configSource: runtime.source,
    orphanIssues,
  };
}

/**
 * Active ou desactive un module. Refuse si le module n'est pas servi par le
 * registre courant (un rebuild est alors requis), si le doctor signale une
 * erreur sur ce module, ou si la nouvelle liste d'actives casserait le
 * registre (dependance desactivee, job en double). L'interface desactive deja
 * le bouton dans ces cas : le noyau ne s'y fie pas.
 */
export async function applyModuleEnabled(
  root: string,
  id: string,
  enabled: boolean
): Promise<ModuleToggleResult> {
  const registry = getRegistry();
  const state = await readModulesState(root);
  const row = state.modules.find((entry) => entry.id === id);
  if (row === undefined) {
    throw new Error(`Module "${id}" inconnu : rien a basculer.`);
  }
  if (!row.served) {
    throw new Error(
      `Le module "${id}" n'est pas charge par ce build : rebuild requis avant de le basculer.`
    );
  }
  if (row.blocked) {
    throw new Error(
      `Le module "${id}" a un probleme du doctor : ${row.issues.join(" ")} Corrige-le avant de le basculer.`
    );
  }

  const nextEnabled = new Set(registry.enabled.map((definition) => definition.id));
  if (enabled) nextEnabled.add(id);
  else nextEnabled.delete(id);

  const error = enabledConfigError([...nextEnabled]);
  if (error !== null) throw new Error(error);

  ensureConfigOnDisk(root);
  if (enabled) enableModule(root, id);
  else disableModule(root, id);

  invalidateRuntimeConfig();
  invalidateRegistry();
  return { id, enabled };
}

export async function installFromSource(
  root: string,
  source: string
): Promise<ModuleInstallResult> {
  const { ref } = parseModuleSource(source);
  if (MOBILE_REFS.has(ref.toLowerCase())) {
    throw new Error(
      `Ref "${ref}" refusee : la version doit etre un tag ou un commit, jamais une branche mobile.`
    );
  }

  const installed: InstalledModule = await installModule({ root, source });
  invalidateRuntimeConfig();
  invalidateRegistry();

  return {
    id: installed.id,
    commit: installed.commit,
    capabilities: installed.capabilities,
    rebuildRequired: true,
  };
}

export function removeById(root: string, id: string): ModuleRemoveResult {
  const lock = readLock(root);
  if (lock.modules[id] === undefined) {
    const bundled = compositionIds(root).includes(id);
    throw new Error(
      bundled
        ? `Le module "${id}" est integre : il ne se retire pas, il se desactive.`
        : `Le module "${id}" n'est pas installe : rien a retirer.`
    );
  }

  removeModule(root, id);
  invalidateRuntimeConfig();
  invalidateRegistry();
  return { id, rebuildRequired: true };
}
