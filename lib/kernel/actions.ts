import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";

import { createModuleContext } from "./context";
import { registry } from "./registry";

/**
 * Point d'entrée unique d'une action de module.
 *
 * Toute action passe par ces étapes, dans cet ordre, et personne ne peut en
 * sauter une : session, validation, exécution, revalidation. C'est la décision
 * E de l'ADR 0001 : un module ne voit ni `requireSession`, ni `revalidatePath`,
 * ni le schéma de validation d'un autre module.
 *
 * La Server Action exportée reste une coquille d'une ligne, parce que Next
 * exige des exports statiques `async function` dans un fichier `"use server"`.
 */
export async function kernelAction<Output = unknown>(
  name: string,
  rawInput: unknown
): Promise<Output> {
  // 1. Session d'abord : un appelant non authentifie ne doit obtenir ni
  // l'existence d'une action, ni un message de validation.
  const session = await requireSession();
  const entry = registry.requireAction(name);

  // 2. Validation : le premier message Zod est le message utilisateur, comme
  // dans les Server Actions du reste du projet.
  const parsed = entry.definition.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  // 3. Exécution avec un contexte fourni par le noyau.
  const ctx = createModuleContext(entry.moduleId, { userId: session.userId });
  const result = (await entry.definition.run(
    parsed.data,
    ctx
  )) as Output;

  // 4. Revalidation déclarée par le module, appliquée par le noyau.
  for (const path of entry.definition.revalidate ?? []) {
    revalidatePath(path);
  }

  return result;
}
