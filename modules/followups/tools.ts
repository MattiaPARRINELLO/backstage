import { z } from "zod";
import { defineTool, toolError, toolOk, verifyWrite } from "@backstage/module-kit";

import { addIntention, getIntentions } from "@/lib/storage";

/**
 * Programmation d'une relance (intention).
 *
 * Ecriture locale verifiee par relecture : le modele ne peut pas annoncer une
 * relance qui n'a pas ete enregistree. Le libelle de la carte de confirmation
 * evite d'afficher le message complet.
 */
export const scheduleFollowupTool = defineTool({
  name: "schedule",
  description:
    "Programme une relance future : l'application t'enverra une notification push a la date indiquee pour revenir sur un sujet. Utilise quand l'utilisateur dit 'relance-moi', 'rappelle-moi de faire X', 'reviens vers moi sur Y'.",
  params: z.object({
    subject: z.string().trim().min(1, "Sujet requis"),
    due_at: z
      .string()
      .min(1, "Echeance requise")
      .refine((value) => !Number.isNaN(new Date(value).getTime()), "Echeance invalide"),
    message: z.string().optional(),
  }),
  sideEffect: "write",
  describeAction: (args) =>
    `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`,
  run: async (args) => {
    const intention = await addIntention({
      subject: args.subject,
      message: args.message,
      dueAt: args.due_at,
    });

    const problem = await verifyWrite(`la relance "${intention.subject}"`, async () => {
      const after = await getIntentions();
      return after.intentions.some((entry) => entry.id === intention.id);
    });
    if (problem) return toolError(problem);

    return toolOk(
      `Relance programmee : « ${intention.subject} » pour le ${new Date(
        intention.dueAt
      ).toLocaleString("fr-FR")}. Tu recevras une notification a ce moment-la.`
    );
  },
});
