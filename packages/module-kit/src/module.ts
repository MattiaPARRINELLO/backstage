import type { ComponentType } from "react";
import type { z } from "zod";

import type { ModuleContext } from "./context";
import type { AnyToolDefinition } from "./tool";
import { KERNEL_API } from "./version";

/** Identifiant de module : kebab-case, unique, utilisé dans les chemins. */
export const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
/** Nom d'outil dans un module : snake_case, namespace par le module. */
export const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

/**
 * Ce qu'un module demande au système hôte. Documentaire en v1 : affiché et
 * confirmé à l'installation, jamais appliqué par le noyau. Un module reste du
 * code arbitraire exécuté dans le processus serveur.
 */
export interface ModuleCapabilities {
  readonly network?: readonly string[];
  readonly env?: readonly string[];
  readonly filesystem?: "module-data";
}

export interface ModuleEvents {
  readonly emits?: readonly string[];
  readonly listens?: readonly string[];
}

export interface ModuleJob {
  readonly id: string;
  /** Expression cron à cinq champs. */
  readonly cron: string;
  readonly handler: (ctx: ModuleContext) => Promise<void>;
}

/**
 * Contribution au prompt système. Le noyau ordonne par priorité décroissante et
 * applique un budget global ; une contribution qui lève est retirée du tour,
 * journalisée, et n'empêche pas la réponse.
 */
export interface PromptContribution {
  readonly id: string;
  readonly priority: number;
  readonly render: (ctx: ModuleContext) => string | Promise<string>;
}

export interface ModuleUi {
  readonly page: ComponentType;
  readonly rail?: {
    readonly label: string;
    /**
     * Icone du rail. Le noyau la sert en SVG statique : utiliser `railIcon()`
     * du kit, pas un composant client (lucide retomberait sur le glyphe neutre).
     */
    readonly icon: ComponentType<{ className?: string }>;
  };
  readonly panel?: ComponentType;
  readonly homeCard?: ComponentType;
}

/**
 * Action métier d'un module. Le module ne l'appelle pas directement : il
 * l'expose par une Server Action d'une ligne (`kernelAction`) qui porte la
 * session, la validation et la revalidation (ADR 0001, décision E).
 */
export interface ActionDefinition<
  Schema extends z.ZodType = z.ZodType,
  Output = unknown,
> {
  readonly name: string;
  readonly input: Schema;
  /** Chemins à rafraîchir après succès, exécutés par le noyau. */
  readonly revalidate?: readonly string[];
  readonly run: (input: z.infer<Schema>, ctx: ModuleContext) => Promise<Output>;
}

export function defineAction<Schema extends z.ZodType, Output>(
  definition: ActionDefinition<Schema, Output>
): ActionDefinition<Schema, Output> {
  return definition;
}

export interface ModuleDefinition {
  readonly id: string;
  /** Version du contrat noyau, comparée à `KERNEL_API` au chargement. */
  readonly apiVersion: number;
  /** Version du module, semver. */
  readonly version: string;
  readonly label: string;
  /** Une phrase, pour le routage en deux étapes. */
  readonly selectionDescription: string;
  /** Description longue, pour le prompt et l'écran d'installation. */
  readonly description: string;
  readonly dependencies?: readonly string[];
  readonly capabilities?: ModuleCapabilities;
  readonly tools?: readonly AnyToolDefinition[];
  readonly prompt?: readonly PromptContribution[];
  readonly events?: ModuleEvents;
  readonly jobs?: readonly ModuleJob[];
  readonly actions?: Readonly<Record<string, ActionDefinition>>;
  readonly ui?: ModuleUi;
  /** Migration des données, exécutée à la mise à jour du module, jamais au chargement. */
  readonly migrate?: (from: string) => Promise<void>;
}

/**
 * Déclare un module.
 *
 * Vérifie ce qui relève de l'auteur (identifiant, version, noms d'outils) pour
 * échouer au plus tôt. Ne vérifie pas `apiVersion` : la compatibilité dépend du
 * noyau qui charge le module, c'est `assertCompatibleApiVersion` qui en décide.
 */
export function defineModule(definition: ModuleDefinition): ModuleDefinition {
  const { id } = definition;
  if (!MODULE_ID_PATTERN.test(id)) {
    throw new Error(
      `Identifiant de module invalide : "${id}". Attendu : kebab-case commencant par une lettre (ex: reminders).`
    );
  }
  if (!SEMVER_PATTERN.test(definition.version)) {
    throw new Error(
      `Module "${id}" : version "${definition.version}" invalide. Attendu : semver (ex: 1.4.0).`
    );
  }
  if (!definition.label.trim() || !definition.selectionDescription.trim()) {
    throw new Error(
      `Module "${id}" : label et selectionDescription sont obligatoires.`
    );
  }
  if (definition.dependencies?.includes(id)) {
    throw new Error(`Module "${id}" : un module ne peut pas dependre de lui-meme.`);
  }

  const seen = new Set<string>();
  for (const tool of definition.tools ?? []) {
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(
        `Module "${id}" : nom d'outil invalide "${tool.name}". Attendu : snake_case (ex: add_reminder).`
      );
    }
    if (seen.has(tool.name)) {
      throw new Error(`Module "${id}" : outil declare deux fois "${tool.name}".`);
    }
    seen.add(tool.name);
  }

  return definition;
}

/** Erreur levée quand un module parle un contrat que ce noyau ne comprend pas. */
export class ModuleIncompatibleError extends Error {
  constructor(
    readonly moduleId: string,
    readonly requiredApi: number,
    readonly kernelApi: number
  ) {
    super(
      `Module "${moduleId}" exige l'API de module ${requiredApi}, ce noyau en est a la version ${kernelApi}. ` +
        `Mets a jour le noyau, ou installe une version anterieure de ce module.`
    );
    this.name = "ModuleIncompatibleError";
  }
}

/**
 * Refuse une `apiVersion` supérieure à celle du noyau, avec un message qui dit
 * les deux versions et quoi faire. Un module plus ancien reste accepté.
 */
export function assertCompatibleApiVersion(
  moduleId: string,
  apiVersion: number,
  kernelApi: number = KERNEL_API
): void {
  if (!Number.isInteger(apiVersion) || apiVersion < 1) {
    throw new Error(
      `Module "${moduleId}" : apiVersion doit etre un entier positif (recu: ${String(apiVersion)}).`
    );
  }
  if (apiVersion > kernelApi) {
    throw new ModuleIncompatibleError(moduleId, apiVersion, kernelApi);
  }
}
