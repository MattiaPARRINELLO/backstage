import { KERNEL_API } from "@backstage/module-kit";

import { modules } from "@/modules";

import { createRegistry, RegistryError, type KernelRegistry } from "./registry-core";
import { readRuntimeConfig, type RuntimeModulesConfig } from "./runtime-config";

/**
 * Registre actif du noyau.
 *
 * Ce fichier est le **seul** du noyau autorise a importer `modules/` (ADR 0001,
 * decision A). La logique du registre reste dans `registry-core.ts`, sans aucun
 * import de module : elle se teste seule.
 *
 * Depuis l'issue #270, la liste des modules actives est lue **a l'execution**
 * (`readRuntimeConfig`) et non plus figee au build par un import statique de
 * `modules.config.json`. `registry` est un accesseur paresseux : chaque lecture
 * d'une propriete relit la config (cache indexe sur le fichier) et reconstruit
 * le registre si elle a change. Une bascule depuis l'interface prend donc effet
 * immediatement, sans redemarrage. Un ajout ou un retrait de module touche
 * `modules/index.ts` et exige toujours un rebuild : le registre ne peut pas
 * importer un fichier absent du bundle.
 */
export * from "./registry-core";

interface ModulesConfig {
  readonly kernelApi?: number;
  readonly modules?: Readonly<Record<string, { readonly enabled?: boolean } | undefined>>;
}

function enabledModuleIds(config: ModulesConfig): string[] {
  return Object.entries(config.modules ?? {})
    .filter(([, settings]) => settings?.enabled === true)
    .map(([id]) => id);
}

function assertKernelApi(config: ModulesConfig): void {
  if (config.kernelApi !== undefined && config.kernelApi > KERNEL_API) {
    throw new RegistryError(
      `modules.config.json exige l'API de module ${config.kernelApi}, ce noyau en est a la version ${KERNEL_API}. ` +
        `Mets a jour le noyau, ou reviens a une configuration anterieure.`
    );
  }
}

function buildRegistry(runtime: RuntimeModulesConfig): KernelRegistry {
  const config = runtime.config as ModulesConfig;
  assertKernelApi(config);
  return createRegistry(modules, { enabled: enabledModuleIds(config) });
}

let cached: { readonly version: string; readonly registry: KernelRegistry } | null = null;

/** Registre courant, reconstruit quand la configuration lue change. */
export function getRegistry(): KernelRegistry {
  const runtime = readRuntimeConfig(process.cwd());
  if (cached === null || cached.version !== runtime.version) {
    cached = { version: runtime.version, registry: buildRegistry(runtime) };
  }
  return cached.registry;
}

/** Force la reconstruction au prochain acces (apres une bascule). */
export function invalidateRegistry(): void {
  cached = null;
}

/**
 * Verifie qu'un ensemble d'identifiants actives reste constructible : une
 * dependance desactivee, un job en double ou un cycle doit etre refuse **avant**
 * d'ecrire la config, sinon le registre leverait a chaque requete.
 * Renvoie le message d'erreur, ou `null` si l'ensemble est valide.
 */
export function enabledConfigError(enabled: readonly string[]): string | null {
  try {
    createRegistry(modules, { enabled });
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export const registry: KernelRegistry = new Proxy({} as KernelRegistry, {
  get(_target, property) {
    return Reflect.get(getRegistry(), property);
  },
  has(_target, property) {
    return Reflect.has(getRegistry(), property);
  },
});
