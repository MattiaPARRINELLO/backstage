import type { PromptContribution } from "@backstage/module-kit";

import { followUpPromptLines } from "./followup";
import { accreditationsStore } from "./store";

/**
 * Bloc « accréditations à relancer » du prompt système.
 *
 * Le noyau ordonne et borne le rendu ; le module ne produit que ses lignes,
 * trois au maximum, les plus urgentes d'abord.
 */
export const accreditationsFollowUpPrompt: PromptContribution = {
  id: "accreditations-follow-up",
  priority: 40,
  render: async () => {
    const data = await accreditationsStore.read();
    return followUpPromptLines(data.accreditations, Date.now());
  },
};
