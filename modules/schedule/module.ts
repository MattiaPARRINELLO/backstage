import { defineModule } from "@backstage/module-kit";

import { getScheduleTool } from "./tools";

/**
 * Module Emploi du temps.
 *
 * Deuxième module migré, sans modification du noyau : le contrat et le pont
 * d'outils suffisent. La synchronisation CESAR reste dans le noyau
 * (`lib/storage/schedule.ts`), le module ne fait que lire et formater.
 */
export default defineModule({
  id: "schedule",
  apiVersion: 1,
  version: "1.0.0",
  label: "Emploi du temps",
  selectionDescription: "Cours, salles et horaires de la semaine.",
  description:
    "Emploi du temps importé de CESAR : cours du jour, du lendemain, de la semaine, ou prochain cours.",
  dependencies: [],
  capabilities: { network: ["cesar.univ-paris1.fr"], filesystem: "module-data" },
  tools: [getScheduleTool],
  // Le module proprietaire porte la cadence : notifications de cours (1 h avant,
  // rafraichies chaque minute) et synchronisation CESAR quand les donnees sont
  // perimees. Le noyau n'a plus de cas particulier pour ce domaine.
  jobs: [
    {
      id: "schedule-notifications",
      cron: "* * * * *",
      handler: async () => {
        const { checkScheduleNotifs, syncScheduleIfStale } = await import(
          "@/lib/notification-schedule"
        );
        // Synchroniser d'abord : après une nuit, l'EDT peut être périmé et la
        // notification de 7 h doit voir les cours du jour, pas ceux de la veille.
        await syncScheduleIfStale();
        await checkScheduleNotifs();
      },
    },
  ],
});
