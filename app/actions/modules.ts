"use server";

import { AppError } from "@/lib/errors";
import { readCatalog, type ModuleCatalog } from "@/lib/kernel/module-catalog";
import { modulesRoot, readModulesState, type ModulesState } from "@/lib/kernel/module-admin";
import { requireSession } from "@/lib/session";

/**
 * Gestion des modules (issue #270).
 *
 * `listModuleCatalog` (issue #271) reste la seule action de lecture du
 * catalogue. Les actions qui ecrivent exigent une session et ne sont pas
 * rate-limitees (meme situation que les autres Server Actions du depot).
 */

export async function listInstalledModules(): Promise<ModulesState> {
  await requireSession();
  return readModulesState(modulesRoot());
}

export async function listModuleCatalog(): Promise<ModuleCatalog> {
  await requireSession();

  const catalog = await readCatalog();
  if (!catalog.ok && catalog.entries.length === 0) {
    throw new AppError("external_unavailable", catalog.error);
  }
  return catalog;
}
