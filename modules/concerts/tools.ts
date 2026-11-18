import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk } from "@backstage/module-kit";

import { getConcerts, prepareConcert } from "@/lib/storage";

/**
 * Concerts : liste locale et preparation terrain.
 *
 * `prepare` combine deux lectures externes (meteo et infos salle via recherche
 * web) : les deux outils sont donc `trust: "untrusted"`. Aucune ecriture.
 */
export const listConcertsTool = defineTool({
  name: "list",
  description:
    "Consulte la liste des concerts en cours (shootes, en selection, en montage, livres).",
  params: z.object({}),
  sideEffect: "read",
  trust: "untrusted",
  run: async () => {
    const data = await getConcerts();
    if (data.events.length === 0) return toolEmpty("Aucun concert enregistre.");

    return toolOk(
      data.events
        .map(
          (event) =>
            `- ${event.artist} @ ${event.venue} le ${new Date(event.date).toLocaleDateString(
              "fr-FR"
            )} [${event.status}]`
        )
        .join("\n")
    );
  },
});

export const prepareConcertTool = defineTool({
  name: "prepare",
  description:
    "Prepare un concert : recupere la meteo, les infos de la salle, et genere une checklist photo personnalisee.",
  params: z.object({
    concertId: z.string().trim().min(1, "ID du concert requis"),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    try {
      const prep = await prepareConcert(args.concertId);
      return toolOk(
        [
          `**Météo :** ${prep.weather}`,
          `**Infos salle :** ${prep.venueInfo}`,
          `**Checklist sac photo :**`,
          ...prep.checklist.map((item) => `- ${item}`),
          `**Conseils trajet :**`,
          ...prep.travelTips.map((tip) => `- ${tip}`),
        ].join("\n")
      );
    } catch (error) {
      return toolError(
        `Erreur : ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});
