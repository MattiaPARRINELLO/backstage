import { KERNEL_API } from "@backstage/module-kit";

import modulesConfig from "@/modules.config.json";
import { modules } from "@/modules";

import { createRegistry, RegistryError, type KernelRegistry } from "./registry-core";

/**
 * Registre actif du noyau.
 *
 * Ce fichier est le **seul** du noyau autorisé à importer `modules/` (ADR 0001,
 * décision A). La logique du registre reste dans `registry-core.ts`, sans aucun
 * import de module : elle se teste seule.
 */
export * from "./registry-core";

interface ModulesConfig {
  readonly kernelApi?: number;
  readonly modules?: Readonly<Record<string, { readonly enabled?: boolean } | undefined>>;
}

const config = modulesConfig as ModulesConfig;

if (config.kernelApi !== undefined && config.kernelApi > KERNEL_API) {
  throw new RegistryError(
    `modules.config.json exige l'API de module ${config.kernelApi}, ce noyau en est a la version ${KERNEL_API}. ` +
      `Mets a jour le noyau, ou reviens a une configuration anterieure.`
  );
}

function enabledModuleIds(): string[] {
  return Object.entries(config.modules ?? {})
    .filter(([, settings]) => settings?.enabled === true)
    .map(([id]) => id);
}

export const registry: KernelRegistry = createRegistry(modules, {
  enabled: enabledModuleIds(),
});
