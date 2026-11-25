"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AppError, isAppError } from "@/lib/errors";
import { readCatalog, type ModuleCatalog } from "@/lib/kernel/module-catalog";
import {
  applyModuleEnabled,
  installFromSource,
  modulesRoot,
  readModulesState,
  removeById,
  type ModuleInstallResult,
  type ModuleRemoveResult,
  type ModulesState,
  type ModuleToggleResult,
} from "@/lib/kernel/module-admin";
import { requireSession } from "@/lib/session";
import { logActivity } from "@/lib/storage";

/**
 * Gestion des modules (issue #270).
 *
 * `listModuleCatalog` (issue #271) reste la seule action de lecture du
 * catalogue. Les autres actions ecrivent `modules.config.json` ou
 * `modules/index.ts` : elles exigent donc une session et ne sont pas
 * rate-limitees (meme situation que les autres Server Actions du depot).
 */

const moduleIdSchema = z.string().trim().min(1, "Identifiant requis");

const toggleSchema = z
  .object({
    id: moduleIdSchema,
    enabled: z.boolean(),
  })
  .strict();

const installSchema = z
  .object({
    source: z.string().trim().min(1, "Source requise : <url-git>#<ref>"),
  })
  .strict();

const removeSchema = z
  .object({
    id: moduleIdSchema,
  })
  .strict();

function asAppError(error: unknown, code: "validation" | "external_unavailable" = "validation"): AppError {
  if (isAppError(error)) return error;
  const message = error instanceof Error ? error.message : "Operation impossible.";
  return new AppError(code, message, { cause: error });
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Payload invalide";
}

function refreshModulePaths(id?: string): void {
  revalidatePath("/settings/modules");
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/m/${id}`);
}

export async function listInstalledModules(): Promise<ModulesState> {
  await requireSession();
  return readModulesState(modulesRoot());
}

export async function setModuleEnabled(input: {
  id: string;
  enabled: boolean;
}): Promise<ModuleToggleResult> {
  await requireSession();

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) throw new AppError("validation", firstIssue(parsed.error));

  let result: ModuleToggleResult;
  try {
    result = await applyModuleEnabled(modulesRoot(), parsed.data.id, parsed.data.enabled);
  } catch (error) {
    throw asAppError(error);
  }

  await logActivity(
    result.enabled ? "module_enabled" : "module_disabled",
    `Module ${result.enabled ? "active" : "desactive"} : ${result.id}`
  );
  refreshModulePaths(result.id);

  return result;
}

export async function installModuleFromSource(input: {
  source: string;
}): Promise<ModuleInstallResult> {
  await requireSession();

  const parsed = installSchema.safeParse(input);
  if (!parsed.success) throw new AppError("validation", firstIssue(parsed.error));

  let result: ModuleInstallResult;
  try {
    result = await installFromSource(modulesRoot(), parsed.data.source);
  } catch (error) {
    // Un clone qui echoue vient du reseau ou du depot, pas de la saisie.
    const message = error instanceof Error ? error.message : "";
    const code = message.startsWith("Impossible de cloner")
      ? "external_unavailable"
      : "validation";
    throw asAppError(error, code);
  }

  await logActivity(
    "module_installed",
    `Module installe : ${result.id}`,
    `commit ${result.commit} - capacites ${JSON.stringify(result.capabilities)}`
  );
  refreshModulePaths(result.id);

  return result;
}

export async function removeModuleById(input: { id: string }): Promise<ModuleRemoveResult> {
  await requireSession();

  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) throw new AppError("validation", firstIssue(parsed.error));

  let result: ModuleRemoveResult;
  try {
    result = removeById(modulesRoot(), parsed.data.id);
  } catch (error) {
    throw asAppError(error);
  }

  await logActivity("module_removed", `Module retire : ${result.id}`);
  refreshModulePaths(result.id);

  return result;
}

export async function listModuleCatalog(): Promise<ModuleCatalog> {
  await requireSession();

  const catalog = await readCatalog();
  if (!catalog.ok && catalog.entries.length === 0) {
    throw new AppError("external_unavailable", catalog.error);
  }
  return catalog;
}
