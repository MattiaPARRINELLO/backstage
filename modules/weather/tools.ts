import { z } from "zod";
import { defineTool, toolError, toolOk } from "@backstage/module-kit";

import { getWeather } from "@/lib/weather";

/**
 * Meteo actuelle d'une ville.
 *
 * Le resultat vient d'OpenWeatherMap : il est declare `untrusted`, donc un
 * tour qui le lit contamine les ecritures suivantes. La lecture vit dans le
 * noyau (`lib/weather.ts`), hors du stockage.
 */
export const getWeatherTool = defineTool({
  name: "get",
  description:
    "Recupere la meteo actuelle d'une ville (temperature, ressenti, humidite, vent). Exemple : 'get_weather Paris'.",
  params: z.object({
    city: z.string().trim().min(1, "Ville requise"),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const result = await getWeather(args.city);
    // `getWeather` encode ses echecs dans le texte (cle absente, ville
    // inconnue, erreur API) : sans ce test, ils seraient annonces comme un
    // succes au modele.
    if (result.startsWith("Erreur") || result.includes("introuvable")) {
      return toolError(result);
    }
    return toolOk(result);
  },
});
