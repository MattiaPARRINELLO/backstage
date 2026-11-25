"use server";

import { AppError } from "@/lib/errors";
import { readCatalog, type ModuleCatalog } from "@/lib/kernel/module-catalog";
import { requireSession } from "@/lib/session";

/**
 * Lecture seule du catalogue de modules (issue #271).
 *
 * Aucune installation ici : cette action ne fait que rendre le catalogue lisible
 * par l'interface. Elle n'est appelee que par la page qui l'affiche, jamais au
 * demarrage. En cas de panne sans cache, l'erreur est explicite plutot qu'une
 * liste vide qui laisserait croire qu'il n'existe aucun module.
 */
export async function listModuleCatalog(): Promise<ModuleCatalog> {
  await requireSession();

  const catalog = await readCatalog();
  if (!catalog.ok && catalog.entries.length === 0) {
    throw new AppError("external_unavailable", catalog.error);
  }
  return catalog;
}
