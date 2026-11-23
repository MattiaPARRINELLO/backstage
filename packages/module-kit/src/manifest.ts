import { MODULE_ID_PATTERN } from "./module";
import { KERNEL_API } from "./version";

/**
 * Forme brute d'un manifeste de module, telle qu'elle sort d'un `import()`
 * dynamique : des champs `unknown` tant que le noyau ne les a pas verifies.
 *
 * Un module installe depuis un depot git n'a pas ete type par l'auteur du
 * noyau : le manifeste est une donnee non fiable, validee avant toute ecriture.
 */
export interface ModuleManifestShape {
  readonly id?: unknown;
  readonly apiVersion?: unknown;
  readonly label?: unknown;
  readonly selectionDescription?: unknown;
  readonly description?: unknown;
  readonly capabilities?: unknown;
}

/** Verifie les champs dont depend le noyau, avec un message actionnable. */
export function assertModuleManifest(
  manifest: ModuleManifestShape,
  kernelApi: number = KERNEL_API
): asserts manifest is ModuleManifestShape & {
  id: string;
  apiVersion: number;
  label: string;
  selectionDescription: string;
  description: string;
} {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Manifeste invalide : le module doit exporter un objet par defaut.");
  }
  if (typeof manifest.id !== "string" || !MODULE_ID_PATTERN.test(manifest.id)) {
    throw new Error(
      `Identifiant de module invalide : "${String(manifest.id)}". Attendu : kebab-case (ex: reminders).`
    );
  }
  if (
    typeof manifest.apiVersion !== "number" ||
    !Number.isInteger(manifest.apiVersion) ||
    manifest.apiVersion < 1
  ) {
    throw new Error(`Module "${manifest.id}" : apiVersion entiere positive requise.`);
  }
  if (manifest.apiVersion > kernelApi) {
    throw new Error(
      `Module "${manifest.id}" exige l'API de module ${manifest.apiVersion}, ce noyau en est a la version ${kernelApi}. ` +
        `Mets a jour le noyau, ou installe une version anterieure de ce module.`
    );
  }
  for (const field of ["label", "selectionDescription", "description"] as const) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      throw new Error(`Module "${manifest.id}" : ${field} est obligatoire.`);
    }
  }
}
