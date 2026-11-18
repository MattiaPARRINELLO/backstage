"use server";

import { kernelAction } from "@/lib/kernel/actions";

/**
 * Invocation generique d'une action de module.
 *
 * Une page de module ne peut pas importer `kernelAction` (cycle registre →
 * module → page → registre). Cette Server Action est fournie par le noyau et
 * liee au module par `ModuleActionsProvider`. La securite ne change pas :
 * `kernelAction` exige la session, resout l'action dans le registre active et
 * applique la validation Zod du module.
 */
export async function callModuleAction(
  moduleId: string,
  name: string,
  input: unknown
): Promise<unknown> {
  return kernelAction(`${moduleId}.${name}`, input);
}
