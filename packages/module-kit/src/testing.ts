import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { z } from "zod";

import type {
  LogLevel,
  ModuleAi,
  ModuleContext,
  ModuleNet,
} from "./context";
import { assertModuleManifest } from "./manifest";
import { defineModule, type ModuleDefinition } from "./module";
import { getDataDirOverride, setDataDir } from "./storage-core";
import type { ToolDefinition, ToolOutput, ToolStatus } from "./tool";
import { KERNEL_API } from "./version";

/**
 * Contrat de test d'un module, publiable avec le kit.
 *
 * Un auteur externe importe `@backstage/module-kit/testing` et teste son module
 * chez lui, sans le noyau : contexte factice, execution d'outil, validation de
 * manifeste et store isole. Aucune regle n'est reecrite ici : la validation de
 * manifeste est celle que le noyau applique a l'installation.
 */

export interface CapturedLog {
  readonly level: LogLevel;
  readonly message: string;
  readonly error?: unknown;
}

export interface CapturedEvent {
  readonly event: string;
  readonly payload?: unknown;
}

export interface CapturedActivity {
  readonly type: string;
  readonly message: string;
  readonly detail?: string;
}

export interface TestContextOptions {
  readonly moduleId?: string;
  readonly userId?: string;
  readonly ai?: ModuleAi;
  readonly net?: ModuleNet;
}

/**
 * `ModuleContext` de test : le logger et le bus capturent au lieu d'ecrire,
 * `activity` enregistre le fil d'activite, et `ai`/`net` restent absents par
 * defaut pour verifier qu'un module degrade proprement.
 */
export interface TestModuleContext extends ModuleContext {
  readonly logs: CapturedLog[];
  readonly events: CapturedEvent[];
  readonly activityEntries: CapturedActivity[];
}

export function createTestContext(
  options: TestContextOptions = {}
): TestModuleContext {
  const logs: CapturedLog[] = [];
  const events: CapturedEvent[] = [];
  const activityEntries: CapturedActivity[] = [];

  return {
    moduleId: options.moduleId ?? "test-module",
    log(level, message, error) {
      logs.push(error === undefined ? { level, message } : { level, message, error });
    },
    emit(event, payload) {
      events.push(payload === undefined ? { event } : { event, payload });
    },
    activity(type, message, detail) {
      activityEntries.push(detail === undefined ? { type, message } : { type, message, detail });
    },
    logs,
    events,
    activityEntries,
    ...(options.userId === undefined ? {} : { userId: options.userId }),
    ...(options.ai === undefined ? {} : { ai: options.ai }),
    ...(options.net === undefined ? {} : { net: options.net }),
  };
}

/**
 * Execute un outil comme le fait le noyau : validation du schema d'abord, puis
 * `run`. Rend le `ToolOutput` brut, sans passer par le pont ni la politique.
 *
 * Comportement identique a `runModuleTool` du noyau : des arguments hors schema
 * et une exception levee par l'outil deviennent un resultat `error`, jamais un
 * `throw`. Un test ecrit donc ce que la production renvoie au modele.
 */
export async function runTool<Schema extends z.ZodType>(
  tool: ToolDefinition<Schema>,
  args: z.input<Schema>,
  ctx: ModuleContext
): Promise<ToolOutput> {
  const parsed = tool.params.safeParse(args);
  if (!parsed.success) {
    return {
      status: "error",
      text: `Erreur : ${parsed.error.issues[0]?.message ?? "arguments invalides"}`,
    };
  }
  try {
    return await tool.run(parsed.data, ctx);
  } catch (error) {
    return {
      status: "error",
      text: `Erreur : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fail(message: string): never {
  throw new Error(message);
}

/** Verifie le statut d'un resultat, et rend le resultat pour enchainer. */
export function assertToolStatus(
  result: ToolOutput,
  expected: ToolStatus
): ToolOutput {
  if (result.status !== expected) {
    fail(
      `Statut "${result.status}" au lieu de "${expected}" : ${result.text}`
    );
  }
  return result;
}

export function assertToolOk(result: ToolOutput): ToolOutput {
  return assertToolStatus(result, "ok");
}

/** Verifie une erreur, et son texte quand un motif est fourni. */
export function assertToolError(result: ToolOutput, pattern?: RegExp): ToolOutput {
  assertToolStatus(result, "error");
  if (pattern && !pattern.test(result.text)) {
    fail(`Texte d'erreur inattendu : ${result.text} (motif attendu : ${pattern})`);
  }
  return result;
}

export function assertToolEmpty(result: ToolOutput): ToolOutput {
  return assertToolStatus(result, "empty");
}

/**
 * Valide un manifeste avec les memes regles que le noyau a l'installation,
 * puis rejoue les regles d'auteur de `defineModule` (identifiant, version,
 * noms d'outils, jobs). `kernelApi` permet de simuler un noyau plus ancien.
 */
export function expectValidModule(
  module: ModuleDefinition,
  options: { kernelApi?: number } = {}
): ModuleDefinition {
  assertModuleManifest(module, options.kernelApi ?? KERNEL_API);
  return defineModule(module);
}

/**
 * Redirige le repertoire de donnees du kit vers un dossier temporaire, execute
 * le test, puis retire le dossier et rend le repertoire precedent. Les stores
 * lisent ce chemin a chaque appel : aucun module ne touche au `data/` du depot
 * hote.
 */
export async function withTempDataDir<T>(
  run: (dir: string) => Promise<T> | T
): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "backstage-module-"));
  const previous = getDataDirOverride();
  setDataDir(dir);
  try {
    return await run(dir);
  } finally {
    setDataDir(previous);
    await rm(dir, { recursive: true, force: true });
  }
}
