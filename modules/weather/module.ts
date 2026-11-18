import { defineModule } from "@backstage/module-kit";

import { getWeatherTool } from "./tools";

/**
 * Module Meteo.
 *
 * Quatrieme module migre, sans modification du noyau : le contrat suffit. La
 * lecture OpenWeatherMap reste dans le noyau jusqu'a la migration du domaine
 * concerts.
 */
export default defineModule({
  id: "weather",
  apiVersion: 1,
  version: "1.0.0",
  label: "Météo",
  selectionDescription: "Météo actuelle d'une ville.",
  description:
    "Température, ressenti, humidité et vent pour une ville, via OpenWeatherMap.",
  dependencies: [],
  capabilities: { network: ["api.openweathermap.org"], env: ["OPENWEATHERMAP_API_KEY"] },
  tools: [getWeatherTool],
});
