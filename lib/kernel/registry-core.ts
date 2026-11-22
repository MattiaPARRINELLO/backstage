import type { ComponentType } from "react";
import {
  assertCompatibleApiVersion,
  isConfirmable,
  isUntrusted,
  KERNEL_API,
  qualifiedName,
  requiresConfirmation,
  type ActionDefinition,
  type AnyToolDefinition,
  type ModuleDefinition,
  type ModuleJob,
  type PromptContribution,
} from "@backstage/module-kit";

/**
 * Registre des modules : la seule structure qui sait quels outils existent.
 *
 * Il est **pur** : il reçoit les manifestes, il ne les importe pas. La racine
 * de composition (`modules/index.ts`, importée par un unique fichier du noyau)
 * lui passe la liste. C'est ce qui permet de tester le registre sans charger
 * un seul module, et d'ajouter une capacité sans éditer le noyau.
 */

export interface RegisteredTool {
  /** `reminders.add` : nom complet dans le registre. */
  readonly name: string;
  readonly moduleId: string;
  readonly definition: AnyToolDefinition;
  readonly requiresConfirmation: boolean;
  /** Une confirmation utilisateur peut débloquer cet outil. */
  readonly confirmable: boolean;
  /** Son résultat peut contenir du contenu tiers. */
  readonly untrusted: boolean;
}

export interface RegisteredPrompt {
  readonly moduleId: string;
  readonly contribution: PromptContribution;
}

export interface RegisteredJob {
  readonly moduleId: string;
  readonly job: ModuleJob;
}

export interface RegisteredAction {
  /** `reminders.create` : nom complet dans le registre. */
  readonly name: string;
  readonly moduleId: string;
  readonly definition: ActionDefinition;
}

export interface RegisteredRailItem {
  readonly moduleId: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export interface KernelRegistry {
  /** Modules chargés, triés par identifiant (ordre stable du prompt). */
  readonly modules: readonly ModuleDefinition[];
  /** Modules activés seulement, même ordre. */
  readonly enabled: readonly ModuleDefinition[];
  /** Outils des modules activés, triés par module puis par nom. */
  readonly tools: readonly RegisteredTool[];
  /** Actions des modules activés, triées par nom complet. */
  readonly actions: readonly RegisteredAction[];
  readonly prompts: readonly RegisteredPrompt[];
  readonly jobs: readonly RegisteredJob[];
  readonly railItems: readonly RegisteredRailItem[];

  module(id: string): ModuleDefinition | undefined;
  tool(name: string): RegisteredTool | undefined;
  /** Comme `tool`, mais lève si l'outil n'existe pas ou n'est pas activé. */
  requireTool(name: string): RegisteredTool;
  action(name: string): RegisteredAction | undefined;
  /** Comme `action`, mais lève si l'action n'existe pas ou n'est pas activée. */
  requireAction(name: string): RegisteredAction;
  /** Job d'un module activé, par identifiant global. */
  job(id: string): RegisteredJob | undefined;
  /** Comme `job`, mais lève si le job n'existe pas ou n'est pas activé. */
  requireJob(id: string): RegisteredJob;
}

export interface RegistryOptions {
  /** Identifiants activés. Absent : tous les modules chargés sont activés. */
  readonly enabled?: readonly string[];
  /** Version du contrat du noyau, injectable pour les tests. */
  readonly kernelApi?: number;
  readonly log?: (level: "warn" | "error", message: string, error?: unknown) => void;
}

/** Erreur de configuration : manifestes incohérents, activation impossible. */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

function byId(a: ModuleDefinition, b: ModuleDefinition): number {
  return a.id.localeCompare(b.id);
}

function assertNoDependencyCycle(modules: readonly ModuleDefinition[]): void {
  const byName = new Map(modules.map((m) => [m.id, m]));
  const visiting = new Set<string>();
  const done = new Set<string>();

  const visit = (id: string, trail: string[]): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      throw new RegistryError(
        `Dependances circulaires entre modules : ${[...trail, id].join(" -> ")}.`
      );
    }
    visiting.add(id);
    for (const dependency of byName.get(id)?.dependencies ?? []) {
      if (byName.has(dependency)) visit(dependency, [...trail, id]);
    }
    visiting.delete(id);
    done.add(id);
  };

  for (const definition of modules) visit(definition.id, []);
}

function toRegisteredTool(owner: ModuleDefinition): RegisteredTool[] {
  return (owner.tools ?? []).map((definition) => ({
    name: qualifiedName(owner.id, definition.name),
    moduleId: owner.id,
    definition,
    requiresConfirmation: requiresConfirmation(definition),
    confirmable: isConfirmable(definition),
    untrusted: isUntrusted(definition),
  }));
}

/**
 * Construit le registre à partir des manifestes.
 *
 * Refuse au chargement, avec un message actionnable : deux modules du même
 * identifiant, une `apiVersion` que ce noyau ne comprend pas, une dépendance
 * absente ou désactivée, un cycle de dépendances, deux modules activés qui
 * déclarent le même job.
 */
export function createRegistry(
  definitions: readonly ModuleDefinition[],
  options: RegistryOptions = {}
): KernelRegistry {
  const kernelApi = options.kernelApi ?? KERNEL_API;
  const log = options.log ?? (() => {});

  const modules = [...definitions].sort(byId);

  const seen = new Set<string>();
  for (const definition of modules) {
    if (seen.has(definition.id)) {
      throw new RegistryError(`Deux modules portent l'identifiant "${definition.id}".`);
    }
    seen.add(definition.id);
    assertCompatibleApiVersion(definition.id, definition.apiVersion, kernelApi);
  }

  const byName = new Map(modules.map((definition) => [definition.id, definition]));

  for (const definition of modules) {
    for (const dependency of definition.dependencies ?? []) {
      if (!byName.has(dependency)) {
        throw new RegistryError(
          `Le module "${definition.id}" depend de "${dependency}", qui n'est pas installe.`
        );
      }
    }
  }
  assertNoDependencyCycle(modules);

  const enabledIds = options.enabled ? new Set(options.enabled) : new Set(seen);
  for (const id of enabledIds) {
    if (!byName.has(id)) {
      // Configuration périmée : on continue plutôt que de bloquer le démarrage
      // sur un module qui a été retiré du disque.
      log("warn", `module "${id}" active dans la configuration mais introuvable, ignore`);
      enabledIds.delete(id);
    }
  }

  const enabled = modules.filter((definition) => enabledIds.has(definition.id));

  for (const definition of enabled) {
    for (const dependency of definition.dependencies ?? []) {
      if (!enabledIds.has(dependency)) {
        throw new RegistryError(
          `Le module "${definition.id}" est active mais sa dependance "${dependency}" ne l'est pas. ` +
            `Active "${dependency}" ou desactive "${definition.id}".`
        );
      }
    }
  }

  const tools = enabled
    .flatMap(toRegisteredTool)
    .sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.name.localeCompare(b.name));

  const toolIndex = new Map<string, RegisteredTool>();
  for (const tool of tools) {
    if (toolIndex.has(tool.name)) {
      throw new RegistryError(`Deux modules declarent l'outil "${tool.name}".`);
    }
    toolIndex.set(tool.name, tool);
  }

  const prompts = enabled
    .flatMap((definition) =>
      (definition.prompt ?? []).map((contribution) => ({ moduleId: definition.id, contribution }))
    )
    .sort(
      (a, b) =>
        b.contribution.priority - a.contribution.priority ||
        a.moduleId.localeCompare(b.moduleId) ||
        a.contribution.id.localeCompare(b.contribution.id)
    );

  const jobs = enabled
    .flatMap((definition) =>
      (definition.jobs ?? []).map((job) => ({ moduleId: definition.id, job }))
    )
    .sort((a, b) => a.job.id.localeCompare(b.job.id));

  const jobIndex = new Map<string, RegisteredJob>();
  for (const entry of jobs) {
    const existing = jobIndex.get(entry.job.id);
    if (existing) {
      throw new RegistryError(
        `Le job "${entry.job.id}" est declare par les modules "${existing.moduleId}" et "${entry.moduleId}". ` +
          `La route /api/cron/[job] est globale : renomme l'un des deux jobs.`
      );
    }
    jobIndex.set(entry.job.id, entry);
  }

  const actions = enabled
    .flatMap((definition) =>
      Object.values(definition.actions ?? {}).map((action) => ({
        // `action.name` fait foi : la cle de l'objet n'est qu'un rangement.
        name: qualifiedName(definition.id, action.name),
        moduleId: definition.id,
        definition: action,
      }))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (new Set(actions.map((action) => action.name)).size !== actions.length) {
    throw new RegistryError("Deux actions de module portent le meme nom complet.");
  }
  const actionIndex = new Map(actions.map((action) => [action.name, action]));

  const railItems = enabled.flatMap((definition) =>
    definition.ui?.rail
      ? [
          {
            moduleId: definition.id,
            label: definition.ui.rail.label,
            icon: definition.ui.rail.icon,
          },
        ]
      : []
  );

  return {
    modules,
    enabled,
    tools,
    prompts,
    jobs,
    railItems,
    module: (id) => byName.get(id),
    actions,
    tool: (name) => toolIndex.get(name),
    requireTool: (name) => {
      const tool = toolIndex.get(name);
      if (!tool) {
        throw new RegistryError(
          `Outil "${name}" inconnu ou module desactive. Outils disponibles : ${
            [...toolIndex.keys()].join(", ") || "aucun"
          }.`
        );
      }
      return tool;
    },
    action: (name) => actionIndex.get(name),
    requireAction: (name) => {
      const action = actionIndex.get(name);
      if (!action) {
        throw new RegistryError(
          `Action "${name}" inconnue ou module desactive. Actions disponibles : ${
            [...actionIndex.keys()].join(", ") || "aucune"
          }.`
        );
      }
      return action;
    },
    job: (id) => jobIndex.get(id),
    requireJob: (id) => {
      const job = jobIndex.get(id);
      if (!job) {
        throw new RegistryError(
          `Job "${id}" inconnu ou module desactive. Jobs disponibles : ${
            [...jobIndex.keys()].join(", ") || "aucun"
          }.`
        );
      }
      return job;
    },
  };
}
